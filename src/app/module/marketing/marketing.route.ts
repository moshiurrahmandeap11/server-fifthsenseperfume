import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { MarketingController } from "./marketing.controller";
import { MarketingValidation } from "./marketing.validation";

const router = Router();

// ==========================================
// 1. COUPON ROUTES
// ==========================================

// Apply coupon code at checkout (Public / Customer)
router.post(
    "/coupons/apply",
    validateRequest(MarketingValidation.applyCouponZodSchema),
    MarketingController.applyCoupon
);

// Manage coupons directory (Admin, Manager, Moderator)
router.get(
    "/coupons",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    MarketingController.getAllCoupons
);

router.post(
    "/coupons",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(MarketingValidation.createCouponZodSchema),
    MarketingController.createCoupon
);

router.get(
    "/coupons/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    MarketingController.getCouponById
);

router.put(
    "/coupons/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(MarketingValidation.updateCouponZodSchema),
    MarketingController.updateCoupon
);

router.delete(
    "/coupons/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    MarketingController.deleteCoupon
);

// ==========================================
// 2. FLASH SALE ROUTES
// ==========================================

// Live active flash sale for public customer storefront (Must precede :idOrSlug)
router.get("/flash-sales/active", MarketingController.getActiveFlashSale);

// Flash sales management directory
router.get(
    "/flash-sales",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    MarketingController.getAllFlashSales
);

router.post(
    "/flash-sales",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(MarketingValidation.createFlashSaleZodSchema),
    MarketingController.createFlashSale
);

router.get("/flash-sales/:idOrSlug", MarketingController.getFlashSaleByIdOrSlug);

router.put(
    "/flash-sales/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(MarketingValidation.updateFlashSaleZodSchema),
    MarketingController.updateFlashSale
);

router.delete(
    "/flash-sales/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    MarketingController.deleteFlashSale
);

// ==========================================
// 3. CAMPAIGN LANDING PAGES
// ==========================================

// Public Direct Ad Traffic Landing Page (by slug)
router.get("/landing-pages/:slug", MarketingController.getLandingPageBySlug);

// Landing pages management directory
router.get(
    "/landing-pages",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    MarketingController.getAllLandingPages
);

router.post(
    "/landing-pages",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(MarketingValidation.createLandingPageZodSchema),
    MarketingController.createLandingPage
);

router.put(
    "/landing-pages/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(MarketingValidation.updateLandingPageZodSchema),
    MarketingController.updateLandingPage
);

router.delete(
    "/landing-pages/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    MarketingController.deleteLandingPage
);

// ==========================================
// 4. META CONVERSIONS API (CAPI) TESTER
// ==========================================
router.post(
    "/capi/test",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(MarketingValidation.testCapiZodSchema),
    MarketingController.testCapiEvent
);

export const MarketingRoutes = router;

