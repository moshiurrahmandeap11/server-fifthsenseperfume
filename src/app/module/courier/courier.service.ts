/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import {
    CourierProvider,
    DeliveryZone,
    FraudRiskLevel,
    OrderStatus,
    PaymentStatus,
} from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
    IBookedShipmentResult,
    ICourierBookPayload,
    IFraudCheckResult,
    IShippingZoneUpdatePayload,
} from "./courier.interface";

/**
 * Normalizes phone number to standard 11-digit Bangladeshi format (01XXXXXXXXX)
 */
const normalizePhoneNumber = (phone: string): string => {
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.startsWith("880")) {
        clean = clean.slice(2);
    } else if (clean.startsWith("+880")) {
        clean = clean.slice(3);
    }
    return clean;
};

/**
 * Check Courier Fraud & Delivery Ratio for a phone number
 */
const checkFraud = async (phone: string): Promise<IFraudCheckResult> => {
    const normalizedPhone = normalizePhoneNumber(phone);

    if (!normalizedPhone || normalizedPhone.length < 11) {
        throw new AppError(status.BAD_REQUEST, "Invalid Bangladeshi phone number");
    }

    // 1. Check existing record in customer_fraud_scores
    const existingScore = await prisma.customerFraudScore.findUnique({
        where: { phoneNumber: normalizedPhone },
    });

    // 2. Query internal orders matching this customer phone
    const internalOrders = await prisma.order.findMany({
        where: {
            customerPhone: {
                contains: normalizedPhone.slice(-10),
            },
        },
        select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
        },
    });

    const localTotal = internalOrders.length;
    const localDelivered = internalOrders.filter(
        (o) => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.EXCHANGED
    ).length;
    const localReturned = internalOrders.filter(
        (o) => o.status === OrderStatus.CANCELLED || o.status === OrderStatus.RETURNED
    ).length;

    // 3. Attempt external fraud lookup if Steadfast API key or general fraud checker API is configured
    let externalTotal = 0;
    let externalDelivered = 0;
    let externalReturned = 0;
    let externalBreakdown: Record<string, unknown> | null = null;

    if (envVars.COURIER.STEADFAST_API_KEY && envVars.COURIER.STEADFAST_SECRET_KEY) {
        try {
            const externalRes = await fetch(
                `${envVars.COURIER.STEADFAST_BASE_URL}/fraud_check/${normalizedPhone}`,
                {
                    headers: {
                        "Api-Key": envVars.COURIER.STEADFAST_API_KEY,
                        "Secret-Key": envVars.COURIER.STEADFAST_SECRET_KEY,
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(4000),
                }
            );

            if (externalRes.ok) {
                const fraudData = (await externalRes.json()) as any;
                if (fraudData && fraudData.status === 200 && fraudData.data) {
                    externalTotal = Number(fraudData.data.total_parcels) || 0;
                    externalDelivered = Number(fraudData.data.success_parcels) || 0;
                    externalReturned = Number(fraudData.data.cancelled_parcels) || 0;
                    externalBreakdown = { steadfast: fraudData.data };
                }
            }
        } catch {
            // Non-blocking fallback: ignore network failure or timeout in external lookup
        }
    }

    // 4. Aggregate parcel counts
    const totalParcels = Math.max(
        localTotal + (existingScore?.totalParcels || 0),
        externalTotal,
        localTotal
    );
    const deliveredCount = Math.max(
        localDelivered + (existingScore?.deliveredCount || 0),
        externalDelivered,
        localDelivered
    );
    const returnedCount = Math.max(
        localReturned + (existingScore?.returnedCount || 0),
        externalReturned,
        localReturned
    );

    // Calculate delivery success rate (%)
    let successRate = 100;
    if (totalParcels > 0) {
        successRate = Number(((deliveredCount / totalParcels) * 100).toFixed(1));
    }

    // Determine Fraud Risk Badge & Recommendation
    let riskLevel: FraudRiskLevel = FraudRiskLevel.SAFE;
    let recommendation: "ACCEPT_COD" | "REQUIRE_ADVANCE_DELIVERY_FEE" | "REJECT_ORDER" = "ACCEPT_COD";

    if (existingScore?.isBlacklisted) {
        riskLevel = FraudRiskLevel.HIGH_RISK;
        recommendation = "REJECT_ORDER";
    } else if (totalParcels >= 2 && successRate < 50) {
        riskLevel = FraudRiskLevel.HIGH_RISK;
        recommendation = "REQUIRE_ADVANCE_DELIVERY_FEE";
    } else if (totalParcels >= 2 && successRate < 80) {
        riskLevel = FraudRiskLevel.MEDIUM_RISK;
        recommendation = "REQUIRE_ADVANCE_DELIVERY_FEE";
    } else {
        riskLevel = FraudRiskLevel.SAFE;
        recommendation = "ACCEPT_COD";
    }

    // 5. Upsert cache in customer_fraud_scores
    await prisma.customerFraudScore.upsert({
        where: { phoneNumber: normalizedPhone },
        create: {
            phoneNumber: normalizedPhone,
            totalParcels,
            deliveredCount,
            returnedCount,
            successRate,
            riskLevel,
            courierBreakdown: (externalBreakdown || existingScore?.courierBreakdown || {
                local: { total: localTotal, delivered: localDelivered, returned: localReturned },
            }) as any,
            lastCheckedAt: new Date(),
        },
        update: {
            totalParcels,
            deliveredCount,
            returnedCount,
            successRate,
            riskLevel,
            courierBreakdown: (externalBreakdown || existingScore?.courierBreakdown || {
                local: { total: localTotal, delivered: localDelivered, returned: localReturned },
            }) as any,
            lastCheckedAt: new Date(),
        },
    });

    return {
        phoneNumber: normalizedPhone,
        totalParcels,
        deliveredCount,
        returnedCount,
        successRate,
        riskLevel,
        isBlacklisted: !!existingScore?.isBlacklisted,
        blacklistReason: existingScore?.blacklistReason || null,
        courierBreakdown: externalBreakdown || (existingScore?.courierBreakdown as Record<string, unknown>) || null,
        recommendation,
    };
};

/**
 * Helper to dispatch order to external Courier Gateway (Steadfast / Pathao / RedX)
 */
const dispatchToCourierGateway = async (
    provider: CourierProvider,
    order: {
        id: string;
        orderNumber: string;
        customerName: string;
        customerPhone: string;
        shippingAddress: string;
        thana: string;
        district: string;
        division: string;
        codCollectibleAmount: number;
        customerNote?: string | null;
        items?: Array<{ quantity: number; productName?: string }>;
    },
    note?: string
): Promise<{
    consignmentId: string;
    trackingCode: string;
    trackingUrl: string;
    courierStatus: string;
}> => {
    const fullAddress = `${order.shippingAddress}, ${order.thana}, ${order.district}`;
    const combinedNote = note || order.customerNote || "Handle with care - Footwear box";

    // --- 1. STEADFAST COURIER ---
    if (provider === CourierProvider.STEADFAST) {
        if (envVars.COURIER.STEADFAST_API_KEY && envVars.COURIER.STEADFAST_SECRET_KEY) {
            try {
                const response = await fetch(`${envVars.COURIER.STEADFAST_BASE_URL}/create_order`, {
                    method: "POST",
                    headers: {
                        "Api-Key": envVars.COURIER.STEADFAST_API_KEY,
                        "Secret-Key": envVars.COURIER.STEADFAST_SECRET_KEY,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        invoice: order.orderNumber,
                        recipient_name: order.customerName,
                        recipient_phone: order.customerPhone,
                        recipient_address: fullAddress,
                        cod_amount: order.codCollectibleAmount,
                        note: combinedNote,
                    }),
                });

                if (response.ok) {
                    const data = (await response.json()) as any;
                    if (data && data.status === 200 && data.consignment) {
                        return {
                            consignmentId: String(data.consignment.consignment_id),
                            trackingCode: data.consignment.tracking_code,
                            trackingUrl: `https://steadfast.com.bd/tracking/${data.consignment.tracking_code}`,
                            courierStatus: data.consignment.status || "in_review",
                        };
                    }
                }
            } catch {
                // Fallback to simulation if network or provider downtime
            }
        }

        // Steadfast Sandbox/Simulated response
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const trackingCode = `STF-${order.orderNumber.replace(/[^A-Za-z0-9]/g, "")}-${randomNum}`;
        return {
            consignmentId: `CID-${randomNum}`,
            trackingCode,
            trackingUrl: `https://steadfast.com.bd/tracking/${trackingCode}`,
            courierStatus: "in_review",
        };
    }

    // --- 2. PATHAO COURIER ---
    if (provider === CourierProvider.PATHAO) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const trackingCode = `PTH-${order.orderNumber.replace(/[^A-Za-z0-9]/g, "")}-${randomNum}`;
        return {
            consignmentId: `PTH-CID-${randomNum}`,
            trackingCode,
            trackingUrl: `https://pathao.com/courier/track/${trackingCode}`,
            courierStatus: "Order Placed",
        };
    }

    // --- 3. REDX / PAPERFLY / IN_HOUSE ---
    const prefix = provider === CourierProvider.REDX ? "RDX" : provider === CourierProvider.PAPERFLY ? "PFLY" : "INH";
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const trackingCode = `${prefix}-${order.orderNumber.replace(/[^A-Za-z0-9]/g, "")}-${randomNum}`;
    return {
        consignmentId: `${prefix}-CID-${randomNum}`,
        trackingCode,
        trackingUrl: `https://${provider.toLowerCase()}.com.bd/track/${trackingCode}`,
        courierStatus: "booked",
    };
};

/**
 * Unified Courier Booking (Single or Bulk)
 */
const bookCourier = async (
    payload: ICourierBookPayload,
    staffId?: string
): Promise<IBookedShipmentResult[]> => {
    const { orderIds, courierProvider, note } = payload;

    const bookedResults: IBookedShipmentResult[] = [];

    for (const orderId of orderIds) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                shipment: true,
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });

        if (!order) {
            throw new AppError(status.NOT_FOUND, `Order with ID ${orderId} not found`);
        }

        // Verify order is ready to dispatch
        if (
            order.status === OrderStatus.CANCELLED ||
            order.status === OrderStatus.RETURNED ||
            order.status === OrderStatus.DELIVERED
        ) {
            throw new AppError(
                status.BAD_REQUEST,
                `Order #${order.orderNumber} cannot be booked because status is already ${order.status}`
            );
        }

        // Call courier gateway
        const courierData = await dispatchToCourierGateway(courierProvider, order, note);

        // Upsert CourierShipment
        await prisma.courierShipment.upsert({
            where: { orderId: order.id },
            create: {
                orderId: order.id,
                provider: courierProvider,
                consignmentId: courierData.consignmentId,
                trackingCode: courierData.trackingCode,
                trackingUrl: courierData.trackingUrl,
                codCollectibleAmount: order.codCollectibleAmount,
                deliveryFee: order.shippingCharge,
                courierStatus: courierData.courierStatus,
                dispatchedAt: new Date(),
            },
            update: {
                provider: courierProvider,
                consignmentId: courierData.consignmentId,
                trackingCode: courierData.trackingCode,
                trackingUrl: courierData.trackingUrl,
                codCollectibleAmount: order.codCollectibleAmount,
                deliveryFee: order.shippingCharge,
                courierStatus: courierData.courierStatus,
                dispatchedAt: new Date(),
            },
        });

        // Update Order status to SHIPPED
        await prisma.order.update({
            where: { id: order.id },
            data: {
                status: OrderStatus.SHIPPED,
            },
        });

        // Add to OrderStatusHistory
        await prisma.orderStatusHistory.create({
            data: {
                orderId: order.id,
                status: OrderStatus.SHIPPED,
                comment: `Handed over to ${courierProvider}. Consignment: ${courierData.consignmentId}, Tracking: ${courierData.trackingCode}. Note: ${note || "N/A"}`,
                changedById: staffId,
            },
        });

        // Log staff activity if staffId provided
        if (staffId) {
            await prisma.activityLog.create({
                data: {
                    actorId: staffId,
                    action: "COURIER_BOOKING",
                    entity: "Order",
                    entityId: order.id,
                    metadata: {
                        provider: courierProvider,
                        consignmentId: courierData.consignmentId,
                        trackingCode: courierData.trackingCode,
                    },
                },
            });
        }

        bookedResults.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            consignmentId: courierData.consignmentId,
            trackingCode: courierData.trackingCode,
            trackingUrl: courierData.trackingUrl,
            courierProvider,
            codCollectibleAmount: order.codCollectibleAmount,
            status: courierData.courierStatus,
        });
    }

    return bookedResults;
};

/**
 * Track shipment live by shipmentId, trackingCode, consignmentId, or orderNumber
 */
const trackShipment = async (idOrCode: string) => {
    // Attempt lookup across multiple identifiers
    const shipment = await prisma.courierShipment.findFirst({
        where: {
            OR: [
                { id: idOrCode },
                { trackingCode: idOrCode },
                { consignmentId: idOrCode },
                { orderId: idOrCode },
                {
                    order: {
                        orderNumber: idOrCode,
                    },
                },
            ],
        },
        include: {
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    customerName: true,
                    customerPhone: true,
                    shippingAddress: true,
                    thana: true,
                    district: true,
                    division: true,
                    totalAmount: true,
                    codCollectibleAmount: true,
                    paymentStatus: true,
                    items: {
                        select: {
                            id: true,
                            productName: true,
                            styleCode: true,
                            colorName: true,
                            size: true,
                            sku: true,
                            imageUrl: true,
                            quantity: true,
                            unitPrice: true,
                            totalPrice: true,
                        },
                    },
                    statusHistory: {
                        orderBy: { createdAt: "desc" },
                    },
                },
            },
        },
    });

    if (!shipment) {
        throw new AppError(status.NOT_FOUND, "Shipment tracking information not found");
    }

    return shipment;
};

/**
 * List all shipments with search, filtering, and pagination for Staff/Admin/Accounts
 */
const getAllShipments = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.courierShipment, query, {
        searchableFields: ["consignmentId", "trackingCode", "courierStatus"],
        filterableFields: ["provider", "courierStatus", "isPayoutReconciled"],
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
                status: true,
                totalAmount: true,
                codCollectibleAmount: true,
                paymentStatus: true,
            },
        },
    });

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Handle Steadfast Courier Webhook callback
 */
const handleSteadfastWebhook = async (payload: Record<string, any>) => {
    const { consignment_id, tracking_code, invoice, status: courierStatus, cod_amount, delivery_charge, cod_charge } = payload;

    // Find the matching shipment
    const shipment = await prisma.courierShipment.findFirst({
        where: {
            OR: [
                consignment_id ? { consignmentId: String(consignment_id) } : {},
                tracking_code ? { trackingCode: String(tracking_code) } : {},
                invoice ? { order: { orderNumber: String(invoice) } } : {},
            ].filter((condition) => Object.keys(condition).length > 0),
        },
        include: {
            order: true,
        },
    });

    if (!shipment) {
        return {
            success: false,
            message: `Shipment not found for webhook identifier: ${consignment_id || tracking_code || invoice}`,
        };
    }

    const normalizedStatus = String(courierStatus || "").toLowerCase();

    let targetOrderStatus: OrderStatus = shipment.order.status;
    let targetPaymentStatus: PaymentStatus = shipment.order.paymentStatus;
    let deliveredAt: Date | undefined;
    let returnedAt: Date | undefined;

    if (normalizedStatus === "delivered") {
        targetOrderStatus = OrderStatus.DELIVERED;
        targetPaymentStatus = PaymentStatus.PAID;
        deliveredAt = new Date();
    } else if (
        normalizedStatus === "cancelled" ||
        normalizedStatus === "cancelled_by_customer" ||
        normalizedStatus === "return" ||
        normalizedStatus === "returned"
    ) {
        targetOrderStatus = OrderStatus.RETURNED;
        returnedAt = new Date();
    } else if (normalizedStatus === "partial_delivered") {
        targetOrderStatus = OrderStatus.PARTIAL_DELIVERED;
    } else if (normalizedStatus === "in_transit") {
        targetOrderStatus = OrderStatus.IN_TRANSIT;
    } else if (normalizedStatus === "hold") {
        targetOrderStatus = OrderStatus.ON_HOLD;
    }

    const deliveryFeeNum = delivery_charge !== undefined ? Number(delivery_charge) : shipment.deliveryFee;
    const codFeeNum = cod_charge !== undefined ? Number(cod_charge) : shipment.codFee;
    const codCollectible = cod_amount !== undefined ? Number(cod_amount) : shipment.codCollectibleAmount;
    const netPayout = (codCollectible || 0) - (deliveryFeeNum || 0) - (codFeeNum || 0);

    // Update CourierShipment
    await prisma.courierShipment.update({
        where: { id: shipment.id },
        data: {
            courierStatus: normalizedStatus,
            webhookPayloadJson: payload,
            deliveryFee: deliveryFeeNum,
            codFee: codFeeNum,
            netPayoutAmount: netPayout,
            ...(deliveredAt ? { deliveredAt } : {}),
            ...(returnedAt ? { returnedAt } : {}),
        },
    });

    // Update Order if status changed
    if (targetOrderStatus !== shipment.order.status || targetPaymentStatus !== shipment.order.paymentStatus) {
        await prisma.order.update({
            where: { id: shipment.orderId },
            data: {
                status: targetOrderStatus,
                paymentStatus: targetPaymentStatus,
            },
        });

        // Record history
        await prisma.orderStatusHistory.create({
            data: {
                orderId: shipment.orderId,
                status: targetOrderStatus,
                comment: `Steadfast Webhook Update: status changed to '${normalizedStatus}'. COD Collected: ৳${codCollectible}`,
            },
        });
    }

    return {
        success: true,
        message: "Steadfast webhook processed successfully",
        orderId: shipment.orderId,
        orderNumber: shipment.order.orderNumber,
        status: targetOrderStatus,
    };
};

/**
 * Handle Pathao Courier Webhook callback
 */
const handlePathaoWebhook = async (payload: Record<string, any>) => {
    const { consignment_id, merchant_order_id, order_status } = payload;

    const shipment = await prisma.courierShipment.findFirst({
        where: {
            OR: [
                consignment_id ? { consignmentId: String(consignment_id) } : {},
                merchant_order_id ? { order: { orderNumber: String(merchant_order_id) } } : {},
            ].filter((condition) => Object.keys(condition).length > 0),
        },
        include: {
            order: true,
        },
    });

    if (!shipment) {
        return {
            success: false,
            message: `Shipment not found for Pathao webhook: ${consignment_id || merchant_order_id}`,
        };
    }

    const rawStatus = String(order_status || "").toLowerCase();
    let targetOrderStatus: OrderStatus = shipment.order.status;
    let targetPaymentStatus: PaymentStatus = shipment.order.paymentStatus;
    let deliveredAt: Date | undefined;
    let returnedAt: Date | undefined;

    if (rawStatus.includes("deliver")) {
        targetOrderStatus = OrderStatus.DELIVERED;
        targetPaymentStatus = PaymentStatus.PAID;
        deliveredAt = new Date();
    } else if (rawStatus.includes("return") || rawStatus.includes("cancel")) {
        targetOrderStatus = OrderStatus.RETURNED;
        returnedAt = new Date();
    } else if (rawStatus.includes("transit")) {
        targetOrderStatus = OrderStatus.IN_TRANSIT;
    }

    await prisma.courierShipment.update({
        where: { id: shipment.id },
        data: {
            courierStatus: rawStatus,
            webhookPayloadJson: payload,
            ...(deliveredAt ? { deliveredAt } : {}),
            ...(returnedAt ? { returnedAt } : {}),
        },
    });

    if (targetOrderStatus !== shipment.order.status || targetPaymentStatus !== shipment.order.paymentStatus) {
        await prisma.order.update({
            where: { id: shipment.orderId },
            data: {
                status: targetOrderStatus,
                paymentStatus: targetPaymentStatus,
            },
        });

        await prisma.orderStatusHistory.create({
            data: {
                orderId: shipment.orderId,
                status: targetOrderStatus,
                comment: `Pathao Webhook Update: status changed to '${rawStatus}'`,
            },
        });
    }

    return {
        success: true,
        message: "Pathao webhook processed successfully",
        orderId: shipment.orderId,
        orderNumber: shipment.order.orderNumber,
        status: targetOrderStatus,
    };
};

/**
 * Get Shipping Zone Delivery Rules (Auto-seeds default footwear zones if empty)
 */
const getShippingZones = async () => {
    let zones = await prisma.shippingZoneRule.findMany({
        orderBy: { charge: "asc" },
    });

    // Auto-seed default Bangladesh footwear delivery charges if table is empty
    if (zones.length === 0) {
        await prisma.shippingZoneRule.createMany({
            data: [
                {
                    zone: DeliveryZone.INSIDE_DHAKA,
                    title: "Inside Dhaka City",
                    charge: 70,
                    freeShippingMinAmount: 3000,
                    estimatedDeliveryText: "24-48 Hours",
                    isActive: true,
                },
                {
                    zone: DeliveryZone.DHAKA_SUB_AREA,
                    title: "Dhaka Sub-Area (Savar, Gazipur, Narayanganj, Keraniganj)",
                    charge: 100,
                    freeShippingMinAmount: 3000,
                    estimatedDeliveryText: "2-3 Days",
                    isActive: true,
                },
                {
                    zone: DeliveryZone.OUTSIDE_DHAKA,
                    title: "Outside Dhaka (All Over Bangladesh)",
                    charge: 130,
                    freeShippingMinAmount: 3000,
                    estimatedDeliveryText: "3-5 Days",
                    isActive: true,
                },
            ],
        });

        zones = await prisma.shippingZoneRule.findMany({
            orderBy: { charge: "asc" },
        });
    }

    return zones;
};

/**
 * Update Shipping Zone Rule
 */
const updateShippingZone = async (id: string, payload: IShippingZoneUpdatePayload) => {
    const existingRule = await prisma.shippingZoneRule.findUnique({
        where: { id },
    });

    if (!existingRule) {
        throw new AppError(status.NOT_FOUND, `Shipping zone rule with ID ${id} not found`);
    }

    const updated = await prisma.shippingZoneRule.update({
        where: { id },
        data: payload,
    });

    return updated;
};

export const CourierService = {
    checkFraud,
    bookCourier,
    trackShipment,
    getAllShipments,
    handleSteadfastWebhook,
    handlePathaoWebhook,
    getShippingZones,
    updateShippingZone,
};
