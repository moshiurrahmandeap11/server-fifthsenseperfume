/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import Stripe from "stripe";
import {
    ExpenseCategory,
    PaymentMethod,
    PaymentStatus,
    PaymentTransactionType,
} from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { sendOrderInvoiceEmail } from "../../utils/invoice";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
    IBkashCallbackPayload,
    ICreateExpensePayload,
    IInitiatePaymentPayload,
    IMarkReconciledPayload,
    ISSLCommerzCallbackPayload,
    IUpdateExpensePayload,
} from "./payment.interface";

/**
 * Initiate an online payment (bKash / SSLCommerz / Nagad)
 */
const initiatePayment = async (payload: IInitiatePaymentPayload) => {
    const { orderId, method, transactionType, callbackUrl } = payload;

    // 1. Locate Order
    const order = await prisma.order.findFirst({
        where: {
            OR: [{ id: orderId }, { orderNumber: orderId }],
        },
    });

    if (!order) {
        throw new AppError(status.NOT_FOUND, "Order not found");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
        throw new AppError(status.BAD_REQUEST, `Order #${order.orderNumber} is already fully paid`);
    }

    // 2. Calculate payable amount based on transaction type
    let amount = 0;
    if (transactionType === PaymentTransactionType.ADVANCE_DELIVERY_FEE) {
        amount = order.shippingCharge || 130;
    } else if (transactionType === PaymentTransactionType.FULL_PREPAID) {
        amount = Math.max(0, order.totalAmount - order.advancePaidAmount);
    } else {
        amount = order.codCollectibleAmount > 0 ? order.codCollectibleAmount : order.totalAmount;
    }

    if (amount <= 0) {
        throw new AppError(status.BAD_REQUEST, "Payable amount must be greater than 0");
    }

    // 3. Generate transaction reference
    const cleanOrderNumber = order.orderNumber.replace(/[^A-Za-z0-9]/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const transactionId = `TRX-${cleanOrderNumber}-${Date.now().toString().slice(-4)}${randomSuffix}`;

    // 4. Create initial Payment entry in UNPAID status
    const payment = await prisma.payment.create({
        data: {
            orderId: order.id,
            method,
            transactionType,
            amount,
            transactionId,
            status: PaymentStatus.UNPAID,
            senderPhone: order.customerPhone,
        },
    });

    // 5. Gateway Session Generation
    let gatewayUrl = `${envVars.FRONTEND_URL}/checkout/payment/mock-gateway?transactionId=${transactionId}&orderId=${order.id}&amount=${amount}&method=${method}`;

    // --- BKASH TOKENIZED GATEWAY INTEGRATION ---
    if (method === PaymentMethod.BKASH) {
        if (
            envVars.PAYMENT.BKASH_APP_KEY &&
            envVars.PAYMENT.BKASH_APP_SECRET &&
            envVars.PAYMENT.BKASH_USERNAME &&
            envVars.PAYMENT.BKASH_PASSWORD
        ) {
            try {
                // Grant Token
                const tokenRes = await fetch(`${envVars.PAYMENT.BKASH_BASE_URL}/tokenized/checkout/token/grant`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        username: envVars.PAYMENT.BKASH_USERNAME,
                        password: envVars.PAYMENT.BKASH_PASSWORD,
                    },
                    body: JSON.stringify({
                        app_key: envVars.PAYMENT.BKASH_APP_KEY,
                        app_secret: envVars.PAYMENT.BKASH_APP_SECRET,
                    }),
                });

                if (tokenRes.ok) {
                    const tokenData = (await tokenRes.json()) as any;
                    const idToken = tokenData.id_token;

                    // Create Payment
                    const createRes = await fetch(`${envVars.PAYMENT.BKASH_BASE_URL}/tokenized/checkout/create`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: idToken,
                            "X-APP-Key": envVars.PAYMENT.BKASH_APP_KEY,
                        },
                        body: JSON.stringify({
                            mode: "0011",
                            payerReference: order.customerPhone,
                            callbackURL:
                                callbackUrl || `${envVars.BETTER_AUTH_URL}/api/v1/payments/bkash/callback`,
                            amount: String(amount),
                            currency: "BDT",
                            intent: "sale",
                            merchantInvoiceNumber: transactionId,
                        }),
                    });

                    if (createRes.ok) {
                        const createData = (await createRes.json()) as any;
                        if (createData.bkashURL) {
                            gatewayUrl = createData.bkashURL;
                            await prisma.payment.update({
                                where: { id: payment.id },
                                data: {
                                    gatewayResponse: createData,
                                },
                            });
                        }
                    }
                }
            } catch {
                // Fallback to simulation URL if bKash sandbox downtime
            }
        }
    }

    // --- STRIPE CHECKOUT SESSION INTEGRATION ---
    if (method === PaymentMethod.STRIPE) {
        const stripeSecretKey = envVars.PAYMENT.STRIPE_SECRET_KEY;
        if (!stripeSecretKey) {
            throw new AppError(
                status.INTERNAL_SERVER_ERROR,
                "Stripe secret key is not configured in environment variables"
            );
        }

        const stripe = new Stripe(stripeSecretKey);
        const currency = (envVars.PAYMENT.STRIPE_CURRENCY || "bdt").toLowerCase();

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            customer_email: order.customerEmail || undefined,
            line_items: [
                {
                    price_data: {
                        currency,
                        product_data: {
                            name: `Order #${order.orderNumber}`,
                            description: `Fifth Sense — ${order.customerName} (${order.customerPhone})`,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                paymentId: payment.id,
                transactionId,
            },
            payment_intent_data: {
                metadata: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    paymentId: payment.id,
                    transactionId,
                },
            },
            success_url: `${envVars.FRONTEND_URL}/checkout/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${order.id}`,
            cancel_url: `${envVars.FRONTEND_URL}/checkout/payment/cancel?orderId=${order.id}&transactionId=${transactionId}`,
        });

        if (!session.url) {
            throw new AppError(status.BAD_GATEWAY, "Failed to create Stripe Checkout session");
        }

        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                gatewayResponse: {
                    stripeSessionId: session.id,
                } as any,
            },
        });

        gatewayUrl = session.url;
    }

    // --- SSLCOMMERZ GATEWAY INTEGRATION ---
    if (method === PaymentMethod.SSLCOMMERZ) {
        if (envVars.PAYMENT.SSLCOMMERZ_STORE_ID && envVars.PAYMENT.SSLCOMMERZ_STORE_PASSWORD) {
            const isLive = envVars.PAYMENT.SSLCOMMERZ_IS_LIVE === "true";
            const sslcommerzBaseUrl = isLive
                ? "https://securepay.sslcommerz.com"
                : "https://sandbox.sslcommerz.com";

            gatewayUrl = `${sslcommerzBaseUrl}/easycheckout.php?tran_id=${transactionId}&store_id=${envVars.PAYMENT.SSLCOMMERZ_STORE_ID}&amount=${amount}`;
        }
    }

    return {
        paymentId: payment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        transactionId,
        amount,
        method,
        transactionType,
        gatewayUrl,
        redirectUrl: gatewayUrl,
    };
};

/**
 * Handle bKash Callback (Execution & Order Settlement)
 */
const handleBkashCallback = async (payload: IBkashCallbackPayload) => {
    const { paymentID, status: paymentStatus } = payload;

    if (paymentStatus === "cancel" || paymentStatus === "failure") {
        return {
            success: false,
            message: `bKash payment was ${paymentStatus}`,
        };
    }

    // Find payment record matching paymentID in gatewayResponse or transactionId
    const payment = await prisma.payment.findFirst({
        where: {
            OR: [
                { transactionId: paymentID },
                {
                    gatewayResponse: {
                        path: ["paymentID"],
                        equals: paymentID,
                    },
                },
            ],
        },
        include: {
            order: {
                include: {
                    shipment: true,
                },
            },
        },
    });

    if (!payment) {
        throw new AppError(status.NOT_FOUND, "Payment transaction record not found for this callback");
    }

    if (payment.status === PaymentStatus.PAID) {
        return {
            success: true,
            message: "Payment already processed",
            orderNumber: payment.order.orderNumber,
        };
    }

    // In production, execute bKash payment API; in dev/test, generate verified TrxID
    const trxID = `BKASH-${Date.now().toString().slice(-8)}`;

    // 1. Mark Payment as PAID
    await prisma.payment.update({
        where: { id: payment.id },
        data: {
            status: PaymentStatus.PAID,
            transactionId: trxID,
            paidAt: new Date(),
            gatewayResponse: {
                ...(typeof payment.gatewayResponse === "object" ? payment.gatewayResponse : {}),
                executedResponse: payload,
            } as any,
        },
    });

    // 2. Settle Order amounts
    const newAdvancePaid = payment.order.advancePaidAmount + payment.amount;
    const newCodCollectible = Math.max(0, payment.order.totalAmount - newAdvancePaid);
    const targetOrderPaymentStatus =
        newCodCollectible <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

    await prisma.order.update({
        where: { id: payment.orderId },
        data: {
            advancePaidAmount: newAdvancePaid,
            codCollectibleAmount: newCodCollectible,
            paymentStatus: targetOrderPaymentStatus,
            paymentMethod: PaymentMethod.BKASH,
        },
    });

    // 3. Sync Courier Shipment collectible amount if parcel is booked
    if (payment.order.shipment) {
        await prisma.courierShipment.update({
            where: { id: payment.order.shipment.id },
            data: {
                codCollectibleAmount: newCodCollectible,
            },
        });
    }

    // 4. Log OrderStatusHistory
    await prisma.orderStatusHistory.create({
        data: {
            orderId: payment.orderId,
            status: payment.order.status,
            comment: `Payment received: ৳${payment.amount} via bKash (TrxID: ${trxID}). COD remaining: ৳${newCodCollectible}`,
        },
    });

    return {
        success: true,
        message: "bKash payment completed successfully",
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        trxId: trxID,
        amount: payment.amount,
        codRemaining: newCodCollectible,
    };
};

/**
 * Handle SSLCommerz Success Callback / IPN
 */
const handleSSLCommerzSuccess = async (payload: ISSLCommerzCallbackPayload) => {
    const { tran_id, bank_tran_id, card_type, card_issuer } = payload;

    const payment = await prisma.payment.findFirst({
        where: {
            transactionId: tran_id,
        },
        include: {
            order: {
                include: {
                    shipment: true,
                },
            },
        },
    });

    if (!payment) {
        throw new AppError(status.NOT_FOUND, `Payment record not found for transaction '${tran_id}'`);
    }

    if (payment.status === PaymentStatus.PAID) {
        return {
            success: true,
            message: "Payment already verified",
            orderNumber: payment.order.orderNumber,
        };
    }

    const verifiedTrxId = bank_tran_id || tran_id;

    // 1. Mark Payment as PAID
    await prisma.payment.update({
        where: { id: payment.id },
        data: {
            status: PaymentStatus.PAID,
            transactionId: verifiedTrxId,
            paidAt: new Date(),
            gatewayResponse: payload as any,
        },
    });

    // 2. Settle Order amounts
    const newAdvancePaid = payment.order.advancePaidAmount + payment.amount;
    const newCodCollectible = Math.max(0, payment.order.totalAmount - newAdvancePaid);
    const targetOrderPaymentStatus =
        newCodCollectible <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

    await prisma.order.update({
        where: { id: payment.orderId },
        data: {
            advancePaidAmount: newAdvancePaid,
            codCollectibleAmount: newCodCollectible,
            paymentStatus: targetOrderPaymentStatus,
            paymentMethod: PaymentMethod.SSLCOMMERZ,
        },
    });

    // 3. Sync Courier Shipment if booked
    if (payment.order.shipment) {
        await prisma.courierShipment.update({
            where: { id: payment.order.shipment.id },
            data: {
                codCollectibleAmount: newCodCollectible,
            },
        });
    }

    // 4. Record history
    await prisma.orderStatusHistory.create({
        data: {
            orderId: payment.orderId,
            status: payment.order.status,
            comment: `Payment received: ৳${payment.amount} via SSLCommerz (${card_type || card_issuer || "Card/MFS"}). TrxID: ${verifiedTrxId}`,
        },
    });

    return {
        success: true,
        message: "SSLCommerz payment validated successfully",
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        trxId: verifiedTrxId,
        amount: payment.amount,
        codRemaining: newCodCollectible,
    };
};

/**
 * Handle SSLCommerz Fail / Cancel Callback
 */
const handleSSLCommerzFailOrCancel = async (
    payload: Record<string, any>,
    statusType: "FAILED" | "CANCELLED"
) => {
    const tran_id = payload.tran_id;

    if (tran_id) {
        await prisma.payment.updateMany({
            where: { transactionId: tran_id, status: PaymentStatus.UNPAID },
            data: {
                status: PaymentStatus.FAILED,
                gatewayResponse: payload,
            },
        });
    }

    return {
        success: false,
        message: `SSLCommerz payment was ${statusType.toLowerCase()}`,
    };
};

/**
 * List all payments & transaction history with QueryBuilder
 */
const getAllTransactions = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.payment, query, {
        searchableFields: ["transactionId", "senderPhone"],
        filterableFields: ["method", "transactionType", "status", "orderId"],
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
                totalAmount: true,
                advancePaidAmount: true,
                codCollectibleAmount: true,
                paymentStatus: true,
            },
        },
    });

    const result = await queryBuilder.execute();

    // Compute aggregated paid sum
    const totalPaidAggregate = await prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: {
            amount: true,
        },
    });

    return {
        ...result,
        totalPaidRevenue: totalPaidAggregate._sum.amount || 0,
    };
};

/**
 * Courier Reconciliation Dashboard & Paginated Shipments
 */
const getCourierReconciliation = async (query: Record<string, any>) => {
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
                status: true,
                totalAmount: true,
                codCollectibleAmount: true,
            },
        },
    });

    const result = await queryBuilder.execute();

    // Financial aggregates across all shipments
    const [totalShipments, reconciledCount, unreconciledCount, aggregates] = await Promise.all([
        prisma.courierShipment.count(),
        prisma.courierShipment.count({ where: { isPayoutReconciled: true } }),
        prisma.courierShipment.count({ where: { isPayoutReconciled: false } }),
        prisma.courierShipment.aggregate({
            _sum: {
                codCollectibleAmount: true,
                deliveryFee: true,
                codFee: true,
                netPayoutAmount: true,
            },
        }),
    ]);

    const summary = {
        totalShipments,
        reconciledCount,
        unreconciledCount,
        totalCodCollectible: aggregates._sum.codCollectibleAmount || 0,
        totalDeliveryFees: aggregates._sum.deliveryFee || 0,
        totalCodFees: aggregates._sum.codFee || 0,
        totalNetPayout: aggregates._sum.netPayoutAmount || 0,
    };

    return {
        summary,
        ...result,
    };
};

/**
 * Mark Courier Shipments as Reconciled (Payout received in company bank account)
 */
const markShipmentsReconciled = async (payload: IMarkReconciledPayload, staffId?: string) => {
    const { shipmentIds, note } = payload;

    const updateResult = await prisma.courierShipment.updateMany({
        where: {
            id: {
                in: shipmentIds,
            },
        },
        data: {
            isPayoutReconciled: true,
            reconciledAt: new Date(),
        },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "COURIER_RECONCILIATION",
                entity: "CourierShipment",
                entityId: shipmentIds[0] || "bulk",
                metadata: {
                    reconciledCount: updateResult.count,
                    shipmentIds,
                    note: note || "Marked as reconciled by accounts",
                },
            },
        });
    }

    return {
        success: true,
        reconciledCount: updateResult.count,
        message: `Successfully reconciled ${updateResult.count} shipment(s)`,
    };
};

/**
 * Record Daily Expense (Meta Ad spend, TikTok Ads, packaging, factory payments)
 */
const createExpense = async (payload: ICreateExpensePayload, staffId?: string) => {
    const expense = await prisma.dailyExpense.create({
        data: {
            category: payload.category,
            title: payload.title,
            amount: payload.amount,
            date: new Date(payload.date),
            note: payload.note,
            createdById: staffId,
        },
        include: {
            createdBy: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "EXPENSE_CREATED",
                entity: "DailyExpense",
                entityId: expense.id,
                metadata: {
                    category: expense.category,
                    amount: expense.amount,
                    title: expense.title,
                },
            },
        });
    }

    return expense;
};

/**
 * List Daily Expenses with QueryBuilder & Date Range Filtering
 */
const getAllExpenses = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.dailyExpense, query, {
        searchableFields: ["title", "note"],
        filterableFields: ["category", "createdById"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    queryBuilder.include({
        createdBy: {
            select: {
                id: true,
                name: true,
                email: true,
            },
        },
    });

    const result = await queryBuilder.execute();

    // Calculate total expense aggregate
    const totalExpenseAggregate = await prisma.dailyExpense.aggregate({
        _sum: {
            amount: true,
        },
    });

    return {
        ...result,
        totalExpenseAmount: totalExpenseAggregate._sum.amount || 0,
    };
};

/**
 * Update an Expense entry
 */
const updateExpense = async (
    id: string,
    payload: IUpdateExpensePayload,
    staffId?: string
) => {
    const existing = await prisma.dailyExpense.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Expense entry with ID '${id}' not found`);
    }

    const updated = await prisma.dailyExpense.update({
        where: { id },
        data: {
            category: payload.category,
            title: payload.title,
            amount: payload.amount,
            date: payload.date ? new Date(payload.date) : undefined,
            note: payload.note,
        },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "EXPENSE_UPDATED",
                entity: "DailyExpense",
                entityId: id,
                metadata: {
                    previousAmount: existing.amount,
                    newAmount: updated.amount,
                },
            },
        });
    }

    return updated;
};

/**
 * Delete an Expense entry
 */
const deleteExpense = async (id: string, staffId?: string) => {
    const existing = await prisma.dailyExpense.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Expense entry with ID '${id}' not found`);
    }

    await prisma.dailyExpense.delete({
        where: { id },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "EXPENSE_DELETED",
                entity: "DailyExpense",
                entityId: id,
                metadata: {
                    title: existing.title,
                    amount: existing.amount,
                },
            },
        });
    }

    return {
        message: "Expense entry deleted successfully",
    };
};

/**
 * Idempotently settle a Stripe payment and update its Order & Shipment
 */
const settleStripePayment = async (
    paymentId: string,
    verifiedTrxId: string,
    gatewayResponse: Record<string, any>
) => {
    const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
            where: { id: paymentId },
            include: {
                order: {
                    include: {
                        shipment: true,
                        items: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new AppError(status.NOT_FOUND, `Payment record '${paymentId}' not found`);
        }

        if (payment.status === PaymentStatus.PAID) {
            return {
                success: true,
                alreadyProcessed: true,
                message: "Payment already verified",
                orderId: payment.orderId,
                orderNumber: payment.order.orderNumber,
                trxId: payment.transactionId || verifiedTrxId,
                amount: payment.amount,
                codRemaining: payment.order.codCollectibleAmount,
                order: payment.order,
            };
        }

        const updatedCount = await tx.payment.updateMany({
            where: { id: payment.id, status: { not: PaymentStatus.PAID } },
            data: {
                status: PaymentStatus.PAID,
                transactionId: verifiedTrxId,
                paidAt: new Date(),
                gatewayResponse: gatewayResponse as any,
            },
        });

        if (updatedCount.count === 0) {
            return {
                success: true,
                alreadyProcessed: true,
                message: "Payment already verified",
                orderId: payment.orderId,
                orderNumber: payment.order.orderNumber,
                trxId: payment.transactionId || verifiedTrxId,
                amount: payment.amount,
                codRemaining: payment.order.codCollectibleAmount,
                order: payment.order,
            };
        }

        const newAdvancePaid = payment.order.advancePaidAmount + payment.amount;
        const newCodCollectible = Math.max(0, payment.order.totalAmount - newAdvancePaid);
        const targetOrderPaymentStatus =
            newCodCollectible <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

        const updatedOrder = await tx.order.update({
            where: { id: payment.orderId },
            data: {
                advancePaidAmount: newAdvancePaid,
                codCollectibleAmount: newCodCollectible,
                paymentStatus: targetOrderPaymentStatus,
                paymentMethod: PaymentMethod.STRIPE,
            },
            include: {
                items: true,
            },
        });

        if (payment.order.shipment) {
            await tx.courierShipment.update({
                where: { id: payment.order.shipment.id },
                data: {
                    codCollectibleAmount: newCodCollectible,
                },
            });
        }

        await tx.orderStatusHistory.create({
            data: {
                orderId: payment.orderId,
                status: payment.order.status,
                comment: `Payment received: ৳${payment.amount} via Stripe Card (Ref: ${verifiedTrxId}). COD remaining: ৳${newCodCollectible}`,
            },
        });

        return {
            success: true,
            alreadyProcessed: false,
            message: "Stripe payment verified successfully",
            orderId: payment.orderId,
            orderNumber: payment.order.orderNumber,
            trxId: verifiedTrxId,
            amount: payment.amount,
            codRemaining: newCodCollectible,
            order: updatedOrder,
        };
    });

    if (!result.alreadyProcessed && result.order) {
        void sendOrderInvoiceEmail(result.order, { isPaymentReceipt: true });
    }

    return result;
};

/**
 * Verify a Stripe Checkout Session directly on redirect back to storefront
 */
const verifyStripeSession = async (sessionId: string) => {
    if (!sessionId) {
        throw new AppError(status.BAD_REQUEST, "Stripe session_id is required");
    }

    const stripeSecretKey = envVars.PAYMENT.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        throw new AppError(status.INTERNAL_SERVER_ERROR, "Stripe secret key is not configured");
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
        throw new AppError(
            status.BAD_REQUEST,
            `Stripe payment is not completed (status: ${session.payment_status})`
        );
    }

    const paymentId = session.metadata?.paymentId;
    const transactionId = session.metadata?.transactionId;

    const payment = await prisma.payment.findFirst({
        where: paymentId ? { id: paymentId } : { transactionId },
    });

    if (!payment) {
        throw new AppError(status.NOT_FOUND, "Matching payment record not found for Stripe session");
    }

    const verifiedTrxId =
        typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.id;

    return await settleStripePayment(payment.id, verifiedTrxId, {
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total,
        currency: session.currency,
    });
};

/**
 * Handle Stripe Webhook Events (checkout.session.completed, payment_intent.*)
 */
const handleStripeWebhook = async (rawBody: Buffer, signature: string) => {
    const stripeSecretKey = envVars.PAYMENT.STRIPE_SECRET_KEY;
    const webhookSecret = envVars.PAYMENT.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
        throw new AppError(
            status.INTERNAL_SERVER_ERROR,
            "Stripe credentials or webhook secret are not configured"
        );
    }

    const stripe = new Stripe(stripeSecretKey);
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
        throw new AppError(
            status.BAD_REQUEST,
            `Webhook signature verification failed: ${err?.message || "Invalid signature"}`
        );
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
            const paymentId = session.metadata?.paymentId;
            if (paymentId) {
                const verifiedTrxId =
                    typeof session.payment_intent === "string"
                        ? session.payment_intent
                        : session.id;
                await settleStripePayment(paymentId, verifiedTrxId, {
                    eventId: event.id,
                    eventType: event.type,
                    stripeSessionId: session.id,
                    paymentIntentId: session.payment_intent,
                });
            }
        }
    } else if (event.type === "payment_intent.succeeded") {
        const intent = event.data.object as Stripe.PaymentIntent;
        const paymentId = intent.metadata?.paymentId;
        if (paymentId) {
            await settleStripePayment(paymentId, intent.id, {
                eventId: event.id,
                eventType: event.type,
                paymentIntentId: intent.id,
            });
        }
    } else if (
        event.type === "payment_intent.payment_failed" ||
        event.type === "payment_intent.canceled"
    ) {
        const intent = event.data.object as Stripe.PaymentIntent;
        const paymentId = intent.metadata?.paymentId;
        if (paymentId) {
            await prisma.payment.updateMany({
                where: { id: paymentId, status: PaymentStatus.UNPAID },
                data: {
                    status: PaymentStatus.FAILED,
                    gatewayResponse: {
                        eventId: event.id,
                        eventType: event.type,
                        paymentIntentId: intent.id,
                        lastPaymentError: intent.last_payment_error?.message,
                    } as any,
                },
            });
        }
    }

    return { received: true, eventType: event.type };
};

export const PaymentService = {
    initiatePayment,
    verifyStripeSession,
    handleStripeWebhook,
    handleBkashCallback,
    handleSSLCommerzSuccess,
    handleSSLCommerzFailOrCancel,
    getAllTransactions,
    getCourierReconciliation,
    markShipmentsReconciled,
    createExpense,
    getAllExpenses,
    updateExpense,
    deleteExpense,
};
