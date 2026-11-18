import {
    ExpenseCategory,
    ExchangeStatus,
    IncompleteOrderStatus,
    OrderStatus,
    Role,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import {
    IDashboardAnalyticsResult,
    IModeratorPerformanceItem,
    INetProfitResult,
    ISizeDemandItem,
    ISizeDemandResult,
} from "./analytics.interface";

/**
 * Executive Overview & Dashboard Metrics
 */
const getDashboardAnalytics = async (): Promise<IDashboardAnalyticsResult> => {
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Parallel metric queries
    const [
        totalRevenueAgg,
        monthRevenueAgg,
        todayRevenueAgg,
        statusCounts,
        todayOrdersCount,
        totalIncomplete,
        convertedIncomplete,
        lowStockVariantsCount,
        pendingExchangesCount,
        unreconciledShipmentsCount,
        unresolvedIncompleteOrdersCount,
        recentOrders,
        recentDaysOrders,
    ] = await Promise.all([
        // 1. Revenues
        prisma.order.aggregate({
            where: {
                status: {
                    notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED],
                },
            },
            _sum: { totalAmount: true },
        }),
        prisma.order.aggregate({
            where: {
                status: {
                    notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED],
                },
                createdAt: { gte: monthStart },
            },
            _sum: { totalAmount: true },
        }),
        prisma.order.aggregate({
            where: {
                status: {
                    notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED],
                },
                createdAt: { gte: todayStart },
            },
            _sum: { totalAmount: true },
        }),

        // 2. Orders grouped by status
        prisma.order.groupBy({
            by: ["status"],
            _count: { id: true },
        }),

        // 3. Today's order count
        prisma.order.count({
            where: { createdAt: { gte: todayStart } },
        }),

        // 4. Incomplete conversion rate counts
        prisma.incompleteOrder.count(),
        prisma.incompleteOrder.count({
            where: { status: IncompleteOrderStatus.CONVERTED },
        }),

        // 5. Operational alerts
        prisma.productVariant.count({
            where: { stockQuantity: { lte: 3 } },
        }),
        prisma.exchangeRequest.count({
            where: { status: ExchangeStatus.PENDING },
        }),
        prisma.courierShipment.count({
            where: { isPayoutReconciled: false },
        }),
        prisma.incompleteOrder.count({
            where: {
                status: {
                    in: [
                        IncompleteOrderStatus.ABANDONED,
                        IncompleteOrderStatus.CALLED_NO_RESPONSE,
                    ],
                },
            },
        }),

        // 6. Recent 5 orders
        prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                orderNumber: true,
                customerName: true,
                customerPhone: true,
                totalAmount: true,
                status: true,
                createdAt: true,
            },
        }),

        // 7. Recent 14 days orders for sales trend chart
        prisma.order.findMany({
            where: {
                createdAt: { gte: fourteenDaysAgo },
                status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
            },
            select: {
                totalAmount: true,
                createdAt: true,
            },
        }),
    ]);

    // Parse status counts
    const statusMap: Record<string, number> = {};
    let totalOrders = 0;
    statusCounts.forEach((s) => {
        statusMap[s.status] = s._count.id;
        totalOrders += s._count.id;
    });

    const deliveredCount = statusMap[OrderStatus.DELIVERED] || 0;
    const returnedCount = statusMap[OrderStatus.RETURNED] || 0;
    const shippedCount = (statusMap[OrderStatus.SHIPPED] || 0) + (statusMap[OrderStatus.IN_TRANSIT] || 0);
    const confirmedCount = statusMap[OrderStatus.CONFIRMED] || 0;
    const pendingCount = statusMap[OrderStatus.PENDING] || 0;
    const cancelledCount = statusMap[OrderStatus.CANCELLED] || 0;

    // Delivery & return rates
    const completedParcels = deliveredCount + returnedCount;
    const deliverySuccessRate =
        completedParcels > 0
            ? Number(((deliveredCount / completedParcels) * 100).toFixed(1))
            : 100;
    const returnRate =
        completedParcels > 0
            ? Number(((returnedCount / completedParcels) * 100).toFixed(1))
            : 0;

    const incompleteCartConversionRate =
        totalIncomplete > 0
            ? Number(((convertedIncomplete / totalIncomplete) * 100).toFixed(1))
            : 0;

    // Construct 14-day daily sales trend
    const trendMap: Record<string, { revenue: number; orderCount: number }> = {};
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split("T")[0];
        trendMap[dateKey] = { revenue: 0, orderCount: 0 };
    }

    recentDaysOrders.forEach((o) => {
        const dateKey = o.createdAt.toISOString().split("T")[0];
        if (trendMap[dateKey]) {
            trendMap[dateKey].revenue += o.totalAmount;
            trendMap[dateKey].orderCount += 1;
        }
    });

    const dailySalesTrend = Object.keys(trendMap).map((date) => ({
        date,
        revenue: Math.round(trendMap[date].revenue),
        orderCount: trendMap[date].orderCount,
    }));

    return {
        revenue: {
            total: Math.round(totalRevenueAgg._sum.totalAmount || 0),
            thisMonth: Math.round(monthRevenueAgg._sum.totalAmount || 0),
            today: Math.round(todayRevenueAgg._sum.totalAmount || 0),
        },
        orders: {
            total: totalOrders,
            delivered: deliveredCount,
            shipped: shippedCount,
            confirmed: confirmedCount,
            pending: pendingCount,
            cancelled: cancelledCount,
            returned: returnedCount,
            todayCount: todayOrdersCount,
        },
        rates: {
            deliverySuccessRate,
            returnRate,
            incompleteCartConversionRate,
        },
        operationalAlerts: {
            lowStockVariantsCount,
            pendingExchangesCount,
            unreconciledShipmentsCount,
            unresolvedIncompleteOrdersCount,
        },
        recentOrders,
        dailySalesTrend,
    };
};

/**
 * Footwear Size-Run Demand Analytics & Factory Production Curve
 */
const getSizeDemandAnalytics = async (): Promise<ISizeDemandResult> => {
    // 1. Fetch sold footwear items grouped by shoe size
    const soldItems = await prisma.orderItem.findMany({
        where: {
            order: {
                status: {
                    notIn: [OrderStatus.CANCELLED],
                },
            },
        },
        select: {
            size: true,
            quantity: true,
        },
    });

    // 2. Fetch current inventory across variants by shoe size
    const variants = await prisma.productVariant.findMany({
        select: {
            size: true,
            stockQuantity: true,
            lowStockThreshold: true,
        },
    });

    // Aggregate sold counts by size
    const sizeSoldMap: Record<string, number> = {};
    let totalFootwearSold = 0;

    soldItems.forEach((item) => {
        const cleanSize = item.size.trim();
        sizeSoldMap[cleanSize] = (sizeSoldMap[cleanSize] || 0) + item.quantity;
        totalFootwearSold += item.quantity;
    });

    // Aggregate stock counts by size
    const sizeStockMap: Record<string, number> = {};
    const sizeBrokenMap: Record<string, number> = {};

    variants.forEach((v) => {
        const cleanSize = v.size.trim();
        sizeStockMap[cleanSize] = (sizeStockMap[cleanSize] || 0) + v.stockQuantity;
        if (v.stockQuantity <= v.lowStockThreshold) {
            sizeBrokenMap[cleanSize] = (sizeBrokenMap[cleanSize] || 0) + 1;
        }
    });

    // Standard Bangladeshi shoe sizes (39 to 45) + any extra found
    const allSizes = Array.from(
        new Set([
            "39",
            "40",
            "41",
            "42",
            "43",
            "44",
            "45",
            ...Object.keys(sizeSoldMap),
            ...Object.keys(sizeStockMap),
        ])
    ).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));

    const sizeCurve: ISizeDemandItem[] = allSizes.map((size) => {
        const totalPairsSold = sizeSoldMap[size] || 0;
        const percentageOfTotal =
            totalFootwearSold > 0
                ? Number(((totalPairsSold / totalFootwearSold) * 100).toFixed(1))
                : 0;

        return {
            size,
            totalPairsSold,
            percentageOfTotal,
            totalStockAvailable: sizeStockMap[size] || 0,
            brokenStockVariantCount: sizeBrokenMap[size] || 0,
        };
    });

    // Calculate factory cartoon box production ratio for 12 pairs
    const recommendedFactoryProductionRatio: Record<string, string> = {};
    sizeCurve.forEach((item) => {
        const pairsPerCartoon =
            totalFootwearSold > 0
                ? Math.max(1, Math.round((item.percentageOfTotal / 100) * 12))
                : 2;
        recommendedFactoryProductionRatio[item.size] = `${pairsPerCartoon} pairs / 12-pair master carton`;
    });

    return {
        totalFootwearSold,
        sizeCurve,
        recommendedFactoryProductionRatio,
    };
};

/**
 * Real Net Profit Calculator (Revenue - COGS - Courier Loss - Ad Spend - Operations)
 */
const getNetProfitAnalytics = async (query: {
    startDate?: string;
    endDate?: string;
}): Promise<INetProfitResult> => {
    const now = new Date();
    const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endDate = query.endDate ? new Date(query.endDate) : now;

    // 1. Gross Revenue from delivered orders in period
    const revenueAgg = await prisma.order.aggregate({
        where: {
            status: {
                in: [OrderStatus.DELIVERED, OrderStatus.EXCHANGED],
            },
            createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { totalAmount: true },
    });
    const grossRevenue = Math.round(revenueAgg._sum.totalAmount || 0);

    // 2. Cost of Goods Sold (COGS)
    const deliveredOrderItems = await prisma.orderItem.findMany({
        where: {
            order: {
                status: {
                    in: [OrderStatus.DELIVERED, OrderStatus.EXCHANGED],
                },
                createdAt: { gte: startDate, lte: endDate },
            },
        },
        select: {
            unitCostPrice: true,
            quantity: true,
        },
    });

    const cogs = Math.round(
        deliveredOrderItems.reduce(
            (sum, item) => sum + (item.unitCostPrice || 0) * item.quantity,
            0
        )
    );

    // 3. Courier Loss (delivery fees on returned / cancelled orders)
    const returnedOrdersAgg = await prisma.order.aggregate({
        where: {
            status: {
                in: [OrderStatus.RETURNED, OrderStatus.CANCELLED],
            },
            createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { shippingCharge: true },
    });
    const courierLoss = Math.round(returnedOrdersAgg._sum.shippingCharge || 0);

    // 4. Marketing Ad Spend & Daily Expenses in period
    const expenses = await prisma.dailyExpense.findMany({
        where: {
            date: { gte: startDate, lte: endDate },
        },
        select: {
            category: true,
            amount: true,
        },
    });

    let adSpend = 0;
    let packagingCost = 0;
    let operationalCost = 0;

    expenses.forEach((e) => {
        if (
            e.category === ExpenseCategory.META_ADS ||
            e.category === ExpenseCategory.TIKTOK_ADS ||
            e.category === ExpenseCategory.GOOGLE_ADS
        ) {
            adSpend += e.amount;
        } else if (e.category === ExpenseCategory.PACKAGING) {
            packagingCost += e.amount;
        } else {
            operationalCost += e.amount;
        }
    });

    adSpend = Math.round(adSpend);
    packagingCost = Math.round(packagingCost);
    operationalCost = Math.round(operationalCost);

    const grossProfit = grossRevenue - cogs;
    const totalExpenses = adSpend + courierLoss + packagingCost + operationalCost;
    const netProfit = grossProfit - totalExpenses;
    const netProfitMargin =
        grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

    return {
        period: {
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
        },
        grossRevenue,
        cogs,
        grossProfit,
        expenses: {
            adSpend,
            courierLoss,
            packagingCost,
            operationalCost,
            totalExpenses,
        },
        netProfit,
        netProfitMargin,
    };
};

/**
 * Call Center & Moderator Performance Metrics
 */
const getModeratorPerformance = async (): Promise<IModeratorPerformanceItem[]> => {
    // 1. Fetch all staff members
    const staffMembers = await prisma.user.findMany({
        where: {
            role: {
                in: [Role.MODERATOR, Role.MANAGER, Role.ADMIN],
            },
            isDeleted: false,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
    });

    // 2. Fetch metrics for each staff member in parallel
    const performanceList: IModeratorPerformanceItem[] = await Promise.all(
        staffMembers.map(async (staff) => {
            const [
                confirmedOrdersCount,
                packedOrdersCount,
                totalHandledIncomplete,
                convertedIncomplete,
            ] = await Promise.all([
                prisma.order.count({
                    where: { confirmedById: staff.id },
                }),
                prisma.order.count({
                    where: { packedById: staff.id },
                }),
                prisma.incompleteOrder.count({
                    where: { handledById: staff.id },
                }),
                prisma.incompleteOrder.count({
                    where: {
                        handledById: staff.id,
                        status: IncompleteOrderStatus.CONVERTED,
                    },
                }),
            ]);

            const conversionRate =
                totalHandledIncomplete > 0
                    ? Number(((convertedIncomplete / totalHandledIncomplete) * 100).toFixed(1))
                    : 0;

            return {
                staffId: staff.id,
                staffName: staff.name,
                email: staff.email,
                role: staff.role,
                confirmedOrdersCount,
                packedOrdersCount,
                incompleteConvertedCount: convertedIncomplete,
                totalOrdersHandled: confirmedOrdersCount + totalHandledIncomplete,
                conversionRate,
            };
        })
    );

    // Sort by confirmed orders count descending
    return performanceList.sort((a, b) => b.confirmedOrdersCount - a.confirmedOrdersCount);
};

export const AnalyticsService = {
    getDashboardAnalytics,
    getSizeDemandAnalytics,
    getNetProfitAnalytics,
    getModeratorPerformance,
};

