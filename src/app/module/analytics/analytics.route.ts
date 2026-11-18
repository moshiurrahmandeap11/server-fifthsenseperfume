import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

// 1. Executive Dashboard Overview (Revenue, Delivery/Return Rates, Alerts, Trends)
router.get(
    "/dashboard",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    AnalyticsController.getDashboardAnalytics
);

// 2. Footwear Size-Run Demand Curve (Shoe sizes 39-45 sold %, available stock, factory ratio)
router.get(
    "/size-demand",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.INVENTORY_STAFF
    ),
    AnalyticsController.getSizeDemandAnalytics
);

// 3. Real Net Profit Calculator (Revenue - COGS - Courier Loss - Ad Spend - Operations)
router.get(
    "/net-profit",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTANT),
    AnalyticsController.getNetProfitAnalytics
);

// 4. Call Center & Moderator Performance (Order confirmations & Incomplete conversion rate)
router.get(
    "/moderator-performance",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    AnalyticsController.getModeratorPerformance
);

export const AnalyticsRoutes = router;

