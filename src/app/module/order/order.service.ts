/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import {
    allDivisionEN,
    districtENOf,
    thanasENOf,
} from "all-bangladeshi-addresses";
import { Prisma } from "../../../generated/prisma/client";
import {
    DeliveryZone,
    IncompleteOrderStatus,
    OrderSource,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Role,
    StockMovementType,
} from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { SystemService } from "../system/system.service";
import {
    IBulkStatusPayload,
    ICheckoutPayload,
    IIncompleteOrderPayload,
    IScanVerifyPackPayload,
    IUpdateOrderPayload,
    IUpdateOrderStatusPayload,
} from "./order.interface";

// Helper to generate unique order number: ORD-YYYYMMDD-XXXX
const generateOrderNumber = (): string => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${dateStr}-${randomSuffix}`;
};

const checkoutOrder = async (
    payload: ICheckoutPayload,
    user?: IRequestUser,
    clientIp?: string,
    clientUserAgent?: string
) => {
    // 1. Fetch and validate all requested variants & check stock
    const variantIds = payload.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, isActive: true },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    styleCode: true,
                    costPrice: true,
                    basePrice: true,
                    discountPrice: true,
                    isDeleted: true,
                },
            },
            productColor: {
                select: { colorName: true, images: true },
            },
        },
    });

    if (variants.length !== payload.items.length) {
        throw new AppError(status.NOT_FOUND, "One or more fragrance variants were not found");
    }

    // 1.5. Validate Bangladesh Administrative Location (Division -> District -> Thana)
    const validDivisions = allDivisionEN() as string[];
    if (!validDivisions.includes(payload.division)) {
        throw new AppError(status.BAD_REQUEST, "Invalid delivery division selected");
    }
    const validDistricts = districtENOf(
        payload.division as Parameters<typeof districtENOf>[0]
    ) as string[];
    if (!validDistricts.includes(payload.district)) {
        throw new AppError(status.BAD_REQUEST, "Invalid delivery district for selected division");
    }
    const validThanas = thanasENOf(
        payload.district as Parameters<typeof thanasENOf>[0]
    ) as string[];
    if (!validThanas.includes(payload.thana)) {
        throw new AppError(status.BAD_REQUEST, "Invalid delivery thana/area for selected district");
    }

    const itemMap = new Map(payload.items.map((i) => [i.variantId, i.quantity]));

    // Validate available stock
    for (const variant of variants) {
        const qtyRequested = itemMap.get(variant.id) || 1;
        if (variant.stockQuantity < qtyRequested) {
            throw new AppError(
                status.BAD_REQUEST,
                `Size ${variant.size} of "${variant.product.name}" is out of stock! Only ${variant.stockQuantity} left.`
            );
        }
    }

    // 2. Financial Calculations
    let subtotal = 0;
    let totalCostPrice = 0;
    const orderItemsData: any[] = [];

    for (const variant of variants) {
        const qty = itemMap.get(variant.id) || 1;
        const unitPrice =
            variant.salePriceOverride ||
            variant.priceOverride ||
            variant.product.discountPrice ||
            variant.product.basePrice;
        const unitCostPrice = variant.product.costPrice;
        const totalPrice = unitPrice * qty;

        subtotal += totalPrice;
        totalCostPrice += unitCostPrice * qty;

        orderItemsData.push({
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.product.name,
            styleCode: variant.product.styleCode,
            colorName: variant.productColor.colorName,
            size: variant.size,
            sku: variant.sku,
            imageUrl: variant.productColor.images[0] || "",
            quantity: qty,
            unitPrice,
            unitCostPrice,
            totalPrice,
        });
    }

    // 3. Secure Server-Side Shipping Charge Calculation (Never trust client deliveryZone)
    const deliveryZone = SystemService.resolveDeliveryZone(
        payload.division,
        payload.district,
        payload.thana
    );
    const [platformSettings, zoneRule] = await Promise.all([
        prisma.platformSettings.findFirst(),
        prisma.shippingZoneRule.findUnique({
            where: { zone: deliveryZone },
        }),
    ]);

    let shippingCharge = 60;
    if (deliveryZone === DeliveryZone.INSIDE_DHAKA) {
        shippingCharge =
            platformSettings?.insideDhakaShipping ?? zoneRule?.charge ?? 60;
    } else if (deliveryZone === DeliveryZone.DHAKA_SUB_AREA) {
        shippingCharge =
            platformSettings?.dhakaSubAreaShipping ?? zoneRule?.charge ?? 100;
    } else {
        shippingCharge =
            platformSettings?.outsideDhakaShipping ?? zoneRule?.charge ?? 120;
    }

    const freeThreshold =
        platformSettings?.freeShippingThreshold ?? zoneRule?.freeShippingMinAmount;
    if (freeThreshold && freeThreshold > 0 && subtotal >= freeThreshold) {
        shippingCharge = 0;
    }

    // 3.5. Validate that requested payment method is enabled in Admin PlatformSettings
    const requestedPaymentMethod = payload.paymentMethod || PaymentMethod.COD;
    const enabledMethods =
        platformSettings?.enabledPaymentMethods &&
        platformSettings.enabledPaymentMethods.length > 0
            ? platformSettings.enabledPaymentMethods
            : ["COD", "BKASH", "NAGAD", "SSLCOMMERZ"];

    if (!enabledMethods.includes(requestedPaymentMethod)) {
        throw new AppError(
            status.BAD_REQUEST,
            `Payment method '${requestedPaymentMethod}' is currently disabled`
        );
    }

    // 4. Coupon Discount Calculation
    let discountAmount = 0;
    let appliedCouponId: string | null = null;

    if (payload.couponCode) {
        const coupon = await prisma.coupon.findUnique({
            where: { code: payload.couponCode.toUpperCase() },
        });

        if (
            coupon &&
            coupon.isActive &&
            (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date()) &&
            subtotal >= coupon.minOrderAmount
        ) {
            appliedCouponId = coupon.id;
            if (coupon.discountType === "PERCENTAGE") {
                discountAmount = (subtotal * coupon.discountValue) / 100;
                if (coupon.maxDiscountAmount) {
                    discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
                }
            } else if (coupon.discountType === "FIXED") {
                discountAmount = Math.min(coupon.discountValue, subtotal);
            } else if (coupon.discountType === "FREE_SHIPPING") {
                shippingCharge = 0;
            }
        }
    }

    // 4.5. Loyalty Points Redemption (Server-Side Verified)
    let loyaltyPointsRedeemed = 0;
    const requestedRedeemPoints = Math.max(0, Math.floor(Number(payload.redeemPoints || 0)));
    const pointValueBdt = platformSettings?.loyaltyPointValueBdt ?? 1;

    if (requestedRedeemPoints > 0 && user?.userId && pointValueBdt > 0) {
        const dbUser = await prisma.user.findUnique({
            where: { id: user.userId },
            select: { loyaltyPoints: true },
        });

        if (!dbUser || dbUser.loyaltyPoints < requestedRedeemPoints) {
            throw new AppError(
                status.BAD_REQUEST,
                "Insufficient loyalty points for redemption"
            );
        }

        const remainingSubtotal = Math.max(0, subtotal - discountAmount);
        const maxRedeemablePoints = Math.floor(remainingSubtotal / pointValueBdt);
        loyaltyPointsRedeemed = Math.min(requestedRedeemPoints, maxRedeemablePoints);

        if (loyaltyPointsRedeemed > 0) {
            discountAmount += loyaltyPointsRedeemed * pointValueBdt;
        }
    }

    const totalAmount = Math.max(0, subtotal - discountAmount + shippingCharge);
    const advancePaidAmount = 0;
    const codCollectibleAmount = totalAmount - advancePaidAmount;
    const orderNumber = generateOrderNumber();

    // 5. Atomic Transaction: Create Order, Deduct Stock & Points, Log Movement
    const createdOrder = await prisma.$transaction(async (tx) => {
        if (loyaltyPointsRedeemed > 0 && user?.userId) {
            await tx.user.update({
                where: { id: user.userId },
                data: {
                    loyaltyPoints: { decrement: loyaltyPointsRedeemed },
                },
            });
        }

        const newOrder = await tx.order.create({
            data: {
                orderNumber,
                userId: user?.userId || null,
                customerName: payload.customerName,
                customerPhone: payload.customerPhone,
                customerEmail: payload.customerEmail || null,
                shippingAddress: payload.shippingAddress,
                division: payload.division,
                district: payload.district,
                thana: payload.thana,
                deliveryZone,
                subtotal,
                discountAmount,
                couponId: appliedCouponId,
                couponCode: payload.couponCode?.toUpperCase() || null,
                shippingCharge,
                loyaltyPointsRedeemed,
                totalAmount,
                advancePaidAmount,
                codCollectibleAmount,
                totalCostPrice,
                status: OrderStatus.PENDING,
                paymentStatus: PaymentStatus.UNPAID,
                paymentMethod: payload.paymentMethod || PaymentMethod.COD,
                source: payload.source || OrderSource.WEBSITE,
                customerNote: payload.customerNote || null,
                fbp: payload.fbp || null,
                fbc: payload.fbc || null,
                clientIp: clientIp || null,
                clientUserAgent: clientUserAgent || null,
                items: {
                    create: orderItemsData,
                },
                statusHistory: {
                    create: {
                        status: OrderStatus.PENDING,
                        comment: "Order placed successfully via checkout",
                        changedById: user?.userId || null,
                    },
                },
            },
            include: {
                items: true,
            },
        });

        // Deduct variant stock & log StockMovement
        for (const item of orderItemsData) {
            const variant = variants.find((v) => v.id === item.variantId)!;
            const newStock = variant.stockQuantity - item.quantity;

            await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stockQuantity: newStock },
            });

            await tx.stockMovement.create({
                data: {
                    variantId: item.variantId,
                    type: StockMovementType.ORDER_DEDUCT,
                    quantityChange: -item.quantity,
                    previousStock: variant.stockQuantity,
                    newStock,
                    referenceId: newOrder.orderNumber,
                    note: `Stock deducted for order ${newOrder.orderNumber}`,
                    actorId: user?.userId || null,
                },
            });
        }

        // If coupon was applied, increment used count
        if (appliedCouponId) {
            await tx.coupon.update({
                where: { id: appliedCouponId },
                data: { usedCount: { increment: 1 } },
            });
        }

        // Mark any abandoned/incomplete order for this phone number as converted
        await tx.incompleteOrder.updateMany({
            where: {
                customerPhone: payload.customerPhone,
                status: IncompleteOrderStatus.ABANDONED,
            },
            data: {
                status: IncompleteOrderStatus.CONVERTED,
                convertedOrderId: newOrder.id,
            },
        });

        return newOrder;
    });

    return createdOrder;
};

const incompleteCapture = async (payload: IIncompleteOrderPayload) => {
    const existing = await prisma.incompleteOrder.findFirst({
        where: {
            customerPhone: payload.customerPhone,
            status: IncompleteOrderStatus.ABANDONED,
        },
        orderBy: { createdAt: "desc" },
    });

    if (existing) {
        return await prisma.incompleteOrder.update({
            where: { id: existing.id },
            data: {
                customerName: payload.customerName || existing.customerName,
                customerEmail: payload.customerEmail || existing.customerEmail,
                shippingAddress: payload.shippingAddress || existing.shippingAddress,
                division: payload.division || existing.division,
                district: payload.district || existing.district,
                thana: payload.thana || existing.thana,
                itemsJson: payload.itemsJson as Prisma.InputJsonValue,
                totalAmount: payload.totalAmount || existing.totalAmount,
                sessionKey: payload.sessionKey || existing.sessionKey,
            },
        });
    }

    return await prisma.incompleteOrder.create({
        data: {
            customerPhone: payload.customerPhone,
            customerName: payload.customerName || null,
            customerEmail: payload.customerEmail || null,
            shippingAddress: payload.shippingAddress || null,
            division: payload.division || null,
            district: payload.district || null,
            thana: payload.thana || null,
            itemsJson: payload.itemsJson as Prisma.InputJsonValue,
            totalAmount: payload.totalAmount || 0,
            source: payload.source || OrderSource.WEBSITE,
            sessionKey: payload.sessionKey || null,
            status: IncompleteOrderStatus.ABANDONED,
        },
    });
};

const getIncompleteOrders = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.incompleteOrder, query, {
        searchableFields: ["customerPhone", "customerName", "shippingAddress"],
        filterableFields: ["status", "source"],
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            handledBy: {
                select: { id: true, name: true, role: true },
            },
        });

    return await queryBuilder.execute();
};

const convertIncompleteOrder = async (
    id: string,
    payload: ICheckoutPayload,
    staffId: string
) => {
    const incomplete = await prisma.incompleteOrder.findUnique({
        where: { id },
    });

    if (!incomplete) {
        throw new AppError(status.NOT_FOUND, "Incomplete order record not found");
    }

    const order = await checkoutOrder({
        ...payload,
        source: OrderSource.PHONE_CALL,
    });

    await prisma.incompleteOrder.update({
        where: { id },
        data: {
            status: IncompleteOrderStatus.CONVERTED,
            convertedOrderId: order.id,
            handledById: staffId,
        },
    });

    return order;
};

const getAllOrders = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.order, query, {
        searchableFields: ["orderNumber", "customerPhone", "customerName", "shippingAddress"],
        filterableFields: [
            "status",
            "paymentStatus",
            "paymentMethod",
            "deliveryZone",
            "source",
            "isBarcodeScanned",
        ],
    });

    if (query.startDate || query.endDate) {
        queryBuilder.where({
            createdAt: {
                ...(query.startDate && { gte: new Date(String(query.startDate)) }),
                ...(query.endDate && { lte: new Date(String(query.endDate)) }),
            },
        });
    }

    queryBuilder
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            items: true,
            shipment: true,
            confirmedBy: { select: { id: true, name: true } },
            packedBy: { select: { id: true, name: true } },
        });

    return await queryBuilder.execute();
};

const getOrderById = async (idOrOrderNumber: string, user?: IRequestUser) => {
    const order = await prisma.order.findFirst({
        where: {
            OR: [{ id: idOrOrderNumber }, { orderNumber: idOrOrderNumber }],
        },
        include: {
            items: {
                include: {
                    variant: {
                        select: { id: true, size: true, sku: true, stockQuantity: true },
                    },
                },
            },
            statusHistory: {
                orderBy: { createdAt: "desc" },
                include: {
                    changedBy: { select: { id: true, name: true, role: true } },
                },
            },
            shipment: true,
            payments: true,
            confirmedBy: { select: { id: true, name: true } },
            packedBy: { select: { id: true, name: true } },
        },
    });

    if (!order) {
        throw new AppError(status.NOT_FOUND, "Order not found");
    }

    // Customer can only view their own orders
    if (user && user.role === Role.CUSTOMER && order.userId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "Access forbidden! This order belongs to another account.");
    }

    return order;
};

const updateOrderStatus = async (
    orderId: string,
    payload: IUpdateOrderStatusPayload,
    staffId: string
) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    });

    if (!order) {
        throw new AppError(status.NOT_FOUND, "Order not found");
    }

    const newStatus = payload.status;
    const oldStatus = order.status;

    if (oldStatus === newStatus) {
        return order;
    }

    return await prisma.$transaction(async (tx) => {
        const updateData: Prisma.OrderUpdateInput = {
            status: newStatus,
            ...(payload.note && { adminNote: payload.note }),
            ...(payload.cancelReason && { cancelReason: payload.cancelReason }),
        };

        if (newStatus === OrderStatus.CONFIRMED && !order.confirmedAt) {
            updateData.confirmedBy = { connect: { id: staffId } };
            updateData.confirmedAt = new Date();
        }

        if (newStatus === OrderStatus.PACKED && !order.packedAt) {
            updateData.packedBy = { connect: { id: staffId } };
            updateData.packedAt = new Date();
        }

        // Restock variants if order is CANCELLED
        if (newStatus === OrderStatus.CANCELLED && oldStatus !== OrderStatus.CANCELLED) {
            for (const item of order.items) {
                const variant = await tx.productVariant.findUnique({
                    where: { id: item.variantId },
                });

                if (variant) {
                    const newStock = variant.stockQuantity + item.quantity;
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: { stockQuantity: newStock },
                    });

                    await tx.stockMovement.create({
                        data: {
                            variantId: item.variantId,
                            type: StockMovementType.ORDER_CANCEL_RESTOCK,
                            quantityChange: item.quantity,
                            previousStock: variant.stockQuantity,
                            newStock,
                            referenceId: order.orderNumber,
                            note: `Stock restored for cancelled order ${order.orderNumber}`,
                            actorId: staffId,
                        },
                    });
                }
            }
        }

        const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: updateData,
        });

        await tx.orderStatusHistory.create({
            data: {
                orderId,
                status: newStatus,
                comment: payload.note || `Status changed from ${oldStatus} to ${newStatus}`,
                changedById: staffId,
            },
        });

        return updatedOrder;
    });
};

const updateOrder = async (
    orderId: string,
    payload: IUpdateOrderPayload,
    staffId: string
) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    });

    if (!order) {
        throw new AppError(status.NOT_FOUND, "Order not found");
    }

    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
        throw new AppError(status.BAD_REQUEST, "Cannot edit an order that has already shipped or delivered");
    }

    return await prisma.$transaction(async (tx) => {
        // If items are being modified on call
        if (payload.items && payload.items.length > 0) {
            // 1. Restock old items
            for (const item of order.items) {
                await tx.productVariant.update({
                    where: { id: item.variantId },
                    data: { stockQuantity: { increment: item.quantity } },
                });
            }

            // 2. Remove old order items
            await tx.orderItem.deleteMany({
                where: { orderId },
            });

            // 3. Prepare new items
            const newVariantIds = payload.items.map((i) => i.variantId);
            const newVariants = await tx.productVariant.findMany({
                where: { id: { in: newVariantIds } },
                include: {
                    product: { select: { id: true, name: true, styleCode: true, costPrice: true, basePrice: true, discountPrice: true } },
                    productColor: { select: { colorName: true, images: true } },
                },
            });

            let newSubtotal = 0;
            let newCostPrice = 0;
            const newOrderItems = [];

            for (const item of payload.items) {
                const variant = newVariants.find((v) => v.id === item.variantId)!;
                if (!variant || variant.stockQuantity < item.quantity) {
                    throw new AppError(status.BAD_REQUEST, `Size ${variant?.size} is out of stock`);
                }

                const unitPrice = item.unitPrice || variant.salePriceOverride || variant.priceOverride || variant.product.discountPrice || variant.product.basePrice;
                const totalPrice = unitPrice * item.quantity;
                newSubtotal += totalPrice;
                newCostPrice += variant.product.costPrice * item.quantity;

                newOrderItems.push({
                    orderId,
                    productId: variant.productId,
                    variantId: variant.id,
                    productName: variant.product.name,
                    styleCode: variant.product.styleCode,
                    colorName: variant.productColor.colorName,
                    size: variant.size,
                    sku: variant.sku,
                    imageUrl: variant.productColor.images[0] || "",
                    quantity: item.quantity,
                    unitPrice,
                    unitCostPrice: variant.product.costPrice,
                    totalPrice,
                });

                // Deduct new stock
                await tx.productVariant.update({
                    where: { id: variant.id },
                    data: { stockQuantity: { decrement: item.quantity } },
                });
            }

            await tx.orderItem.createMany({
                data: newOrderItems,
            });

            const newTotalAmount = Math.max(0, newSubtotal - order.discountAmount + order.shippingCharge);
            const newCodCollectible = newTotalAmount - order.advancePaidAmount;

            await tx.order.update({
                where: { id: orderId },
                data: {
                    subtotal: newSubtotal,
                    totalCostPrice: newCostPrice,
                    totalAmount: newTotalAmount,
                    codCollectibleAmount: newCodCollectible,
                },
            });
        }

        const updated = await tx.order.update({
            where: { id: orderId },
            data: {
                ...(payload.customerName && { customerName: payload.customerName }),
                ...(payload.customerPhone && { customerPhone: payload.customerPhone }),
                ...(payload.shippingAddress && { shippingAddress: payload.shippingAddress }),
                ...(payload.division && { division: payload.division }),
                ...(payload.district && { district: payload.district }),
                ...(payload.thana && { thana: payload.thana }),
                ...(payload.adminNote && { adminNote: payload.adminNote }),
            },
            include: { items: true },
        });

        await tx.orderStatusHistory.create({
            data: {
                orderId,
                status: order.status,
                comment: payload.adminNote || "Order items or shipping details edited on call",
                changedById: staffId,
            },
        });

        return updated;
    });
};

const bulkStatusUpdate = async (payload: IBulkStatusPayload, staffId: string) => {
    const results = [];
    for (const orderId of payload.orderIds) {
        try {
            const updated = await updateOrderStatus(orderId, { status: payload.newStatus, note: payload.note }, staffId);
            results.push(updated);
        } catch (err) {
            console.error(`Failed to update status for order ${orderId}:`, err);
        }
    }

    return {
        totalRequested: payload.orderIds.length,
        totalUpdated: results.length,
        status: payload.newStatus,
    };
};

const scanVerifyPack = async (payload: IScanVerifyPackPayload, staffId: string) => {
    const order = await prisma.order.findUnique({
        where: { id: payload.orderId },
        include: {
            items: {
                include: {
                    variant: { select: { sku: true, barcode: true, size: true } },
                },
            },
        },
    });

    if (!order) {
        throw new AppError(status.NOT_FOUND, "Order not found");
    }

    const matchedItem = order.items.find(
        (i) => i.variant.barcode === payload.scannedBarcode || i.variant.sku === payload.scannedBarcode || i.sku === payload.scannedBarcode
    );

    if (!matchedItem) {
        throw new AppError(
            status.BAD_REQUEST,
            `Barcode mismatch! The scanned barcode "${payload.scannedBarcode}" does not match any shoe size in this order.`
        );
    }

    const updated = await prisma.order.update({
        where: { id: payload.orderId },
        data: {
            isBarcodeScanned: true,
            status: OrderStatus.PACKED,
            packedById: staffId,
            packedAt: new Date(),
        },
    });

    await prisma.orderStatusHistory.create({
        data: {
            orderId: payload.orderId,
            status: OrderStatus.PACKED,
            comment: `Packing verified via barcode scanner for SKU: ${matchedItem.sku} (Size ${matchedItem.size})`,
            changedById: staffId,
        },
    });

    return {
        success: true,
        message: "Shoe box barcode verified and order marked as PACKED",
        verifiedSku: matchedItem.sku,
        size: matchedItem.size,
        order: updated,
    };
};

const trackPublicOrder = async (orderNumber: string, phone: string) => {
    const order = await prisma.order.findFirst({
        where: {
            orderNumber,
            customerPhone: phone,
        },
        select: {
            id: true,
            orderNumber: true,
            status: true,
            deliveryZone: true,
            shippingAddress: true,
            totalAmount: true,
            createdAt: true,
            items: {
                select: {
                    productName: true,
                    styleCode: true,
                    colorName: true,
                    size: true,
                    imageUrl: true,
                    quantity: true,
                    totalPrice: true,
                },
            },
            shipment: {
                select: {
                    provider: true,
                    consignmentId: true,
                    trackingCode: true,
                    courierStatus: true,
                },
            },
            statusHistory: {
                orderBy: { createdAt: "desc" },
                select: {
                    status: true,
                    comment: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!order) {
        throw new AppError(status.NOT_FOUND, "No order found matching this order number and phone number");
    }

    return order;
};

export const OrderService = {
    checkoutOrder,
    incompleteCapture,
    getIncompleteOrders,
    convertIncompleteOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    updateOrder,
    bulkStatusUpdate,
    scanVerifyPack,
    trackPublicOrder,
};
