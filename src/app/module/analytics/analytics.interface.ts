export interface IDashboardAnalyticsResult {
    revenue: {
        total: number;
        thisMonth: number;
        today: number;
    };
    orders: {
        total: number;
        delivered: number;
        shipped: number;
        confirmed: number;
        pending: number;
        cancelled: number;
        returned: number;
        todayCount: number;
    };
    rates: {
        deliverySuccessRate: number;
        returnRate: number;
        incompleteCartConversionRate: number;
    };
    operationalAlerts: {
        lowStockVariantsCount: number;
        pendingExchangesCount: number;
        unreconciledShipmentsCount: number;
        unresolvedIncompleteOrdersCount: number;
    };
    recentOrders: Array<{
        id: string;
        orderNumber: string;
        customerName: string;
        customerPhone: string;
        totalAmount: number;
        status: string;
        createdAt: Date;
    }>;
    dailySalesTrend: Array<{
        date: string;
        revenue: number;
        orderCount: number;
    }>;
}

export interface ISizeDemandItem {
    size: string;
    totalPairsSold: number;
    percentageOfTotal: number;
    totalStockAvailable: number;
    brokenStockVariantCount: number;
}

export interface ISizeDemandResult {
    totalFootwearSold: number;
    sizeCurve: ISizeDemandItem[];
    recommendedFactoryProductionRatio: Record<string, string>;
}

export interface INetProfitResult {
    period: {
        startDate: string;
        endDate: string;
    };
    grossRevenue: number;
    cogs: number;
    grossProfit: number;
    expenses: {
        adSpend: number;
        courierLoss: number;
        packagingCost: number;
        operationalCost: number;
        totalExpenses: number;
    };
    netProfit: number;
    netProfitMargin: number;
}

export interface IModeratorPerformanceItem {
    staffId: string;
    staffName: string;
    email: string;
    role: string;
    confirmedOrdersCount: number;
    packedOrdersCount: number;
    incompleteConvertedCount: number;
    totalOrdersHandled: number;
    conversionRate: number;
}

