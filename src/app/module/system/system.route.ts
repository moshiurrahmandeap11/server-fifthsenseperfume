import { NextFunction, Request, Response, Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { multerUpload } from "../../config/multer.config";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SystemController } from "./system.controller";
import { SystemValidation } from "./system.validation";

const router = Router();

// ==========================================
// 1. PLATFORM CONFIGURATION & SETTINGS
// ==========================================
router.get("/settings", SystemController.getPlatformSettings);

router.put(
    "/settings",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    multerUpload.fields([
        { name: "logoUrl", maxCount: 1 },
        { name: "faviconUrl", maxCount: 1 },
    ]),
    (req: Request, _res: Response, next: NextFunction) => {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data);
        }
        next();
    },
    validateRequest(SystemValidation.updatePlatformSettingsZodSchema),
    SystemController.updatePlatformSettings
);

// ==========================================
// 2. CMS BANNERS
// ==========================================
router.get("/banners", SystemController.getAllBanners);

router.post(
    "/banners",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    multerUpload.single("image"),
    (req: Request, _res: Response, next: NextFunction) => {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data);
        }
        next();
    },
    validateRequest(SystemValidation.createBannerZodSchema),
    SystemController.createBanner
);

router.get("/banners/:id", SystemController.getBannerById);

router.put(
    "/banners/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    multerUpload.single("image"),
    (req: Request, _res: Response, next: NextFunction) => {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data);
        }
        next();
    },
    validateRequest(SystemValidation.updateBannerZodSchema),
    SystemController.updateBanner
);

router.delete(
    "/banners/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    SystemController.deleteBanner
);

// ==========================================
// 3. PHYSICAL SHOWROOM OUTLETS
// ==========================================
router.get("/showrooms", SystemController.getAllShowrooms);

router.post(
    "/showrooms",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(SystemValidation.createShowroomZodSchema),
    SystemController.createShowroom
);

router.get("/showrooms/:id", SystemController.getShowroomById);

router.put(
    "/showrooms/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(SystemValidation.updateShowroomZodSchema),
    SystemController.updateShowroom
);

router.delete(
    "/showrooms/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    SystemController.deleteShowroom
);

export const SystemRoutes = router;

