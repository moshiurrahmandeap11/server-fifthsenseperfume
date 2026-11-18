/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import {
    ExchangeStatus,
    ExchangeType,
    OrderStatus,
    OrderSource,
    PaymentMethod,
    PaymentStatus,
    ReturnQcStatus,
    StockMovementType,
} from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
    ICreateExchangeRequestPayload,
    IExchangeQcDecisionPayload,
    IExchangeStatusDecisionPayload,
} from "./exchange.interface";

/**
 * Customer / Guest submits a size exchange or defect return request
 */
const createExchangeRequest = async (payload: ICreateExchangeRequestPayload) => {
    const { orderId, orderItemId, oldVariantId, newVariantId, type, reason, customerImages } = payload;

    // 1. Find Order
    const order = await prisma.order.findFirst({
        where: {
            OR: [{ id: orderId }, { orderNumber: orderId }],
        },
        include: {
            items: true,
        },
    });

    if (!order) {
        throw new AppError(status.NOT_FOUND, "Order not found");
    }

    // Exchanges are only allowed on delivered orders
    if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.EXCHANGED) {
        throw new AppError(
            status.BAD_REQUEST,
            `Exchange/Return can only be requested for DELIVERED orders. Current status: ${order.status}`
        );
    }

    // 2. Validate Order Item belongs to this order
    const orderItem = order.items.find((item) => item.id === orderItemId);
    if (!orderItem) {
        throw new AppError(status.BAD_REQUEST, "The specified item does not belong to this order");
    }

    if (orderItem.variantId !== oldVariantId) {
        throw new AppError(status.BAD_REQUEST, "Current variant ID does not match the purchased order item");
    }

    // 3. Check for existing active exchange request on this item
    const existingExchange = await prisma.exchangeRequest.findFirst({
        where: {
            orderItemId,
            status: {
                in: [
                    ExchangeStatus.PENDING,
                    ExchangeStatus.APPROVED,
                    ExchangeStatus.REPLACEMENT_DISPATCHED,
                ],
            },
        },
    });

    if (existingExchange) {
        throw new AppError(
            status.CONFLICT,
            `An active exchange request #${existingExchange.exchangeNumber} is already in progress for this shoe item`
        );
    }

    // 4. Validate requested replacement variant if provided
    if (newVariantId) {
        const newVariant = await prisma.productVariant.findUnique({
            where: { id: newVariantId },
        });

        if (!newVariant) {
            throw new AppError(status.NOT_FOUND, "Requested replacement shoe size/variant not found");
        }

        if (newVariant.id === oldVariantId) {
            throw new AppError(
                status.BAD_REQUEST,
                "Requested replacement size variant cannot be identical to the current one"
            );
        }
    }

    // 5. Generate Exchange Number
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const exchangeNumber = `EXC-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    // 6. Create ExchangeRequest
    const result = await prisma.exchangeRequest.create({
        data: {
            exchangeNumber,
            orderId: order.id,
            orderItemId: orderItem.id,
            oldVariantId,
            newVariantId: newVariantId || null,
            type: type || ExchangeType.SIZE_EXCHANGE,
            reason,
            customerImages: customerImages || [],
            status: ExchangeStatus.PENDING,
            returnQcStatus: ReturnQcStatus.AWAITING_RETURN,
        },
        include: {
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    customerName: true,
                    customerPhone: true,
                },
            },
            oldVariant: {
                select: {
                    id: true,
                    size: true,
                    sku: true,
                },
            },
            newVariant: {
                select: {
                    id: true,
                    size: true,
                    sku: true,
                },
            },
        },
    });

    // 7. Update parent order status & add history comment
    await prisma.order.update({
        where: { id: order.id },
        data: {
            status: OrderStatus.EXCHANGE_REQUESTED,
        },
    });

    await prisma.orderStatusHistory.create({
        data: {
            orderId: order.id,
            status: OrderStatus.EXCHANGE_REQUESTED,
            comment: `Customer submitted ${result.type} (#${exchangeNumber}). Reason: ${reason}`,
        },
    });

    return result;
};

/**
 * List all exchange requests with QueryBuilder (search, filter, sort, paginate)
 */
const getAllExchanges = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.exchangeRequest, query, {
        searchableFields: ["exchangeNumber", "reason", "adminNote"],
        filterableFields: ["status", "type", "returnQcStatus", "orderId"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    queryBuilder.include({
        order: {
            select: {
                id: true,
                orderNumber: true,
                customerName: true,
                customerPhone: true,
                shippingAddress: true,
                district: true,
                division: true,
                status: true,
                totalAmount: true,
            },
        },
        orderItem: {
            select: {
                id: true,
                productName: true,
                styleCode: true,
                colorName: true,
                size: true,
                sku: true,
                imageUrl: true,
                unitPrice: true,
            },
        },
        oldVariant: {
            select: {
                id: true,
                size: true,
                sku: true,
                stockQuantity: true,
            },
        },
        newVariant: {
            select: {
                id: true,
                size: true,
                sku: true,
                stockQuantity: true,
                productColor: {
                    select: {
                        colorName: true,
                    },
                },
            },
        },
        replacementOrder: {
            select: {
                id: true,
                orderNumber: true,
                status: true,
                totalAmount: true,
                codCollectibleAmount: true,
            },
        },
    });

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Get exchange request details by ID or exchangeNumber
 */
const getExchangeById = async (id: string) => {
    const exchange = await prisma.exchangeRequest.findFirst({
        where: {
            OR: [{ id }, { exchangeNumber: id }],
        },
        include: {
            order: {
                include: {
                    statusHistory: {
                        orderBy: { createdAt: "desc" },
                    },
                },
            },
            orderItem: true,
            oldVariant: {
                include: {
                    product: true,
                    productColor: true,
                },
            },
            newVariant: {
                include: {
                    product: true,
                    productColor: true,
                },
            },
            replacementOrder: {
                include: {
                    shipment: true,
                },
            },
        },
    });

    if (!exchange) {
        throw new AppError(status.NOT_FOUND, `Exchange request with ID/Number '${id}' not found`);
    }

    return exchange;
};

/**
 * Unified Moderator Decision on Exchange Request (Approve / Reject)
 */
const decideExchangeStatus = async (
    id: string,
    payload: IExchangeStatusDecisionPayload,
    staffId?: string
) => {
    const exchange = await prisma.exchangeRequest.findFirst({
        where: {
            OR: [{ id }, { exchangeNumber: id }],
        },
        include: {
            order: true,
            orderItem: true,
            newVariant: {
                include: {
                    product: true,
                    productColor: true,
                },
            },
            oldVariant: true,
        },
    });

    if (!exchange) {
        throw new AppError(status.NOT_FOUND, `Exchange request with ID '${id}' not found`);
    }

    if (exchange.status !== ExchangeStatus.PENDING) {
        throw new AppError(
            status.BAD_REQUEST,
            `Exchange #${exchange.exchangeNumber} has already been resolved with status '${exchange.status}'`
        );
    }

    // --- CASE 1: REJECT EXCHANGE REQUEST ---
    if (payload.status === ExchangeStatus.REJECTED) {
        const rejectionNote = payload.rejectionReason || payload.adminNote || "Rejected by moderator";

        const updated = await prisma.exchangeRequest.update({
            where: { id: exchange.id },
            data: {
                status: ExchangeStatus.REJECTED,
                adminNote: rejectionNote,
                resolvedAt: new Date(),
            },
        });

        // Revert parent order status back to DELIVERED
        await prisma.order.update({
            where: { id: exchange.orderId },
            data: {
                status: OrderStatus.DELIVERED,
            },
        });

        await prisma.orderStatusHistory.create({
            data: {
                orderId: exchange.orderId,
                status: OrderStatus.DELIVERED,
                comment: `Exchange Request #${exchange.exchangeNumber} rejected. Reason: ${rejectionNote}`,
                changedById: staffId,
            },
        });

        if (staffId) {
            await prisma.activityLog.create({
                data: {
                    actorId: staffId,
                    action: "EXCHANGE_REJECTED",
                    entity: "ExchangeRequest",
                    entityId: exchange.id,
                    metadata: {
                        rejectionReason: rejectionNote,
                    },
                },
            });
        }

        return updated;
    }

    // --- CASE 2: APPROVE EXCHANGE REQUEST ---
    if (payload.status === ExchangeStatus.APPROVED) {
        let replacementOrder = null;

        // If replacement shoe variant is designated, reserve stock and create replacement Order
        if (exchange.newVariant) {
            if (exchange.newVariant.stockQuantity < 1) {
                throw new AppError(
                    status.BAD_REQUEST,
                    `Requested replacement size ${exchange.newVariant.size} is out of stock in warehouse (Current Stock: 0)`
                );
            }

            // 1. Decrement warehouse stock for replacement variant
            await prisma.productVariant.update({
                where: { id: exchange.newVariant.id },
                data: {
                    stockQuantity: { decrement: 1 },
                },
            });

            // 2. Audit StockMovement: EXCHANGE_RESERVE
            await prisma.stockMovement.create({
                data: {
                    variantId: exchange.newVariant.id,
                    type: StockMovementType.EXCHANGE_RESERVE,
                    quantityChange: -1,
                    previousStock: exchange.newVariant.stockQuantity,
                    newStock: exchange.newVariant.stockQuantity - 1,
                    referenceId: exchange.id,
                    note: `Reserved for Size Exchange #${exchange.exchangeNumber}`,
                    actorId: staffId,
                },
            });

            // 3. Compute delivery fee: brand bearing cost or customer paying
            const deliveryFee = payload.isBrandBearingCost
                ? 0
                : payload.exchangeDeliveryFee !== undefined
                ? payload.exchangeDeliveryFee
                : exchange.order.shippingCharge || 70;

            const replacementOrderNumber = `${exchange.order.orderNumber}-EXC`;

            // 4. Create child replacement order
            replacementOrder = await prisma.order.create({
                data: {
                    orderNumber: replacementOrderNumber,
                    parentOrderId: exchange.order.id,
                    userId: exchange.order.userId,
                    customerName: exchange.order.customerName,
                    customerPhone: exchange.order.customerPhone,
                    customerEmail: exchange.order.customerEmail,
                    shippingAddress: exchange.order.shippingAddress,
                    division: exchange.order.division,
                    district: exchange.order.district,
                    thana: exchange.order.thana,
                    deliveryZone: exchange.order.deliveryZone,
                    subtotal: 0,
                    shippingCharge: deliveryFee,
                    totalAmount: deliveryFee,
                    codCollectibleAmount: deliveryFee,
                    status: OrderStatus.CONFIRMED,
                    paymentStatus: deliveryFee === 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID,
                    paymentMethod: PaymentMethod.COD,
                    source: OrderSource.EXCHANGE_REPLACEMENT,
                    adminNote: `Size Replacement Order for #${exchange.order.orderNumber} (Exchange #${exchange.exchangeNumber}). Note: ${payload.courierNote || ""}`,
                    items: {
                        create: {
                            productId: exchange.newVariant.productId,
                            variantId: exchange.newVariant.id,
                            productName: exchange.newVariant.product.name,
                            styleCode: exchange.newVariant.product.styleCode,
                            colorName: exchange.newVariant.productColor.colorName,
                            size: exchange.newVariant.size,
                            sku: exchange.newVariant.sku,
                            imageUrl:
                                (exchange.newVariant.productColor.images &&
                                    exchange.newVariant.productColor.images[0]) ||
                                exchange.orderItem.imageUrl,
                            quantity: 1,
                            unitPrice: 0,
                            unitCostPrice: 0,
                            totalPrice: 0,
                        },
                    },
                },
            });

            // 5. Update ExchangeRequest
            const updated = await prisma.exchangeRequest.update({
                where: { id: exchange.id },
                data: {
                    status: ExchangeStatus.APPROVED,
                    replacementOrderId: replacementOrder.id,
                    exchangeDeliveryFee: deliveryFee,
                    adminNote:
                        payload.adminNote ||
                        `Approved by moderator. Replacement Order #${replacementOrderNumber} generated.`,
                    resolvedAt: new Date(),
                },
                include: {
                    replacementOrder: true,
                    newVariant: true,
                    oldVariant: true,
                },
            });

            // 6. Log status history on parent order
            await prisma.orderStatusHistory.create({
                data: {
                    orderId: exchange.orderId,
                    status: OrderStatus.EXCHANGE_REQUESTED,
                    comment: `Exchange #${exchange.exchangeNumber} approved. Replacement order #${replacementOrderNumber} dispatched with delivery fee: ৳${deliveryFee}`,
                    changedById: staffId,
                },
            });

            if (staffId) {
                await prisma.activityLog.create({
                    data: {
                        actorId: staffId,
                        action: "EXCHANGE_APPROVED",
                        entity: "ExchangeRequest",
                        entityId: exchange.id,
                        metadata: {
                            status: "APPROVED",
                            replacementOrderNumber,
                            deliveryFee,
                        },
                    },
                });
            }

            return updated;
        }

        // If no new variant (Return for Refund flow)
        const updated = await prisma.exchangeRequest.update({
            where: { id: exchange.id },
            data: {
                status: ExchangeStatus.APPROVED,
                adminNote: payload.adminNote || "Return request approved, awaiting item arrival for QC & refund.",
                resolvedAt: new Date(),
            },
        });

        return updated;
    }

    throw new AppError(status.BAD_REQUEST, "Invalid decision status. Must be APPROVED or REJECTED");
};

/**
 * Warehouse Returns QC Queue (Items returned or awaiting inspection)
 */
const getPendingQcExchanges = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.exchangeRequest, query, {
        searchableFields: ["exchangeNumber", "reason"],
        filterableFields: ["returnQcStatus", "status", "type"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    queryBuilder.include({
        order: {
            select: {
                id: true,
                orderNumber: true,
                customerName: true,
                customerPhone: true,
                district: true,
            },
        },
        orderItem: {
            select: {
                id: true,
                productName: true,
                styleCode: true,
                colorName: true,
                size: true,
                sku: true,
                imageUrl: true,
            },
        },
        oldVariant: {
            select: {
                id: true,
                size: true,
                sku: true,
                stockQuantity: true,
            },
        },
        replacementOrder: {
            select: {
                id: true,
                orderNumber: true,
                status: true,
            },
        },
    });

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Warehouse Gate: Mark returned parcel physically received from courier
 */
const receiveReturnedParcel = async (id: string, staffId?: string) => {
    const exchange = await prisma.exchangeRequest.findFirst({
        where: {
            OR: [{ id }, { exchangeNumber: id }],
        },
    });

    if (!exchange) {
        throw new AppError(status.NOT_FOUND, "Exchange request not found");
    }

    const updated = await prisma.exchangeRequest.update({
        where: { id: exchange.id },
        data: {
            returnQcStatus: ReturnQcStatus.RECEIVED_PENDING_QC,
        },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "RETURN_PARCEL_RECEIVED",
                entity: "ExchangeRequest",
                entityId: exchange.id,
                metadata: {
                    returnQcStatus: ReturnQcStatus.RECEIVED_PENDING_QC,
                },
            },
        });
    }

    return updated;
};

/**
 * Warehouse QC Decision on Returned Footwear: Restock or Damaged Write-off
 */
const decideReturnQc = async (
    id: string,
    payload: IExchangeQcDecisionPayload,
    staffId?: string
) => {
    const { decision, receivedCondition, note } = payload;

    const exchange = await prisma.exchangeRequest.findFirst({
        where: {
            OR: [{ id }, { exchangeNumber: id }],
        },
        include: {
            oldVariant: true,
        },
    });

    if (!exchange) {
        throw new AppError(status.NOT_FOUND, "Exchange request not found");
    }

    if (
        exchange.returnQcStatus === ReturnQcStatus.QC_PASSED_RESTOCKED ||
        exchange.returnQcStatus === ReturnQcStatus.QC_FAILED_DAMAGED
    ) {
        throw new AppError(
            status.BAD_REQUEST,
            `QC has already been performed for Exchange #${exchange.exchangeNumber} with result '${exchange.returnQcStatus}'`
        );
    }

    // --- CASE 1: QC PASSED (Restock the unworn shoe back to warehouse) ---
    if (decision === ReturnQcStatus.QC_PASSED_RESTOCKED) {
        // 1. Increment warehouse stock for old variant
        await prisma.productVariant.update({
            where: { id: exchange.oldVariantId },
            data: {
                stockQuantity: { increment: 1 },
            },
        });

        // 2. Audit StockMovement: RETURN_QC_RESTOCK
        await prisma.stockMovement.create({
            data: {
                variantId: exchange.oldVariantId,
                type: StockMovementType.RETURN_QC_RESTOCK,
                quantityChange: 1,
                previousStock: exchange.oldVariant.stockQuantity,
                newStock: exchange.oldVariant.stockQuantity + 1,
                referenceId: exchange.id,
                note: `QC Passed & Restocked (#${exchange.exchangeNumber}): ${receivedCondition || note || "Clean condition, tags intact"}`,
                actorId: staffId,
            },
        });

        // 3. Update Exchange status to COMPLETED if already approved
        const updated = await prisma.exchangeRequest.update({
            where: { id: exchange.id },
            data: {
                returnQcStatus: ReturnQcStatus.QC_PASSED_RESTOCKED,
                status:
                    exchange.status === ExchangeStatus.APPROVED
                        ? ExchangeStatus.COMPLETED
                        : exchange.status,
                adminNote: exchange.adminNote
                    ? `${exchange.adminNote} | QC: PASSED (${receivedCondition || note || ""})`
                    : `QC Passed: ${receivedCondition || note || ""}`,
            },
        });

        if (staffId) {
            await prisma.activityLog.create({
                data: {
                    actorId: staffId,
                    action: "QC_PASSED_RESTOCKED",
                    entity: "ExchangeRequest",
                    entityId: exchange.id,
                    metadata: {
                        decision,
                        variantId: exchange.oldVariantId,
                    },
                },
            });
        }

        return updated;
    }

    // --- CASE 2: QC FAILED (Shoe worn/damaged, cannot be resold) ---
    if (decision === ReturnQcStatus.QC_FAILED_DAMAGED) {
        // Audit StockMovement: DAMAGED
        await prisma.stockMovement.create({
            data: {
                variantId: exchange.oldVariantId,
                type: StockMovementType.DAMAGED,
                quantityChange: 0,
                previousStock: exchange.oldVariant.stockQuantity,
                newStock: exchange.oldVariant.stockQuantity,
                referenceId: exchange.id,
                note: `QC Failed - Damaged/Worn shoe (#${exchange.exchangeNumber}): ${note || receivedCondition || "Creased leather / soiled outsole"}`,
                actorId: staffId,
            },
        });

        const updated = await prisma.exchangeRequest.update({
            where: { id: exchange.id },
            data: {
                returnQcStatus: ReturnQcStatus.QC_FAILED_DAMAGED,
                adminNote: exchange.adminNote
                    ? `${exchange.adminNote} | QC: FAILED DAMAGED (${note || receivedCondition || ""})`
                    : `QC Failed: ${note || receivedCondition || ""}`,
            },
        });

        if (staffId) {
            await prisma.activityLog.create({
                data: {
                    actorId: staffId,
                    action: "QC_FAILED_DAMAGED",
                    entity: "ExchangeRequest",
                    entityId: exchange.id,
                    metadata: {
                        decision,
                        reason: note || receivedCondition,
                    },
                },
            });
        }

        return updated;
    }

    throw new AppError(
        status.BAD_REQUEST,
        "Invalid QC decision. Must be 'QC_PASSED_RESTOCKED' or 'QC_FAILED_DAMAGED'"
    );
};

export const ExchangeService = {
    createExchangeRequest,
    getAllExchanges,
    getExchangeById,
    decideExchangeStatus,
    getPendingQcExchanges,
    receiveReturnedParcel,
    decideReturnQc,
};
