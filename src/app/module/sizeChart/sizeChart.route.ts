import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { uploadSingle } from "../../config/multer.config";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SizeChartController } from "./sizeChart.controller";
import { createSizeChartZodSchema, updateSizeChartZodSchema } from "./sizeChart.validation";

const router = Router();

// Public Storefront Routes
router.get(
    "/",
    SizeChartController.getAllSizeCharts
);

router.get(
    "/:id",
    SizeChartController.getSizeChartById
);

// Admin & Manager Management Routes
router.post(
    "/",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    uploadSingle("guideImage"),
    validateRequest(createSizeChartZodSchema),
    SizeChartController.createSizeChart
);

router.put(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    uploadSingle("guideImage"),
    validateRequest(updateSizeChartZodSchema),
    SizeChartController.updateSizeChart
);

router.delete(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    SizeChartController.deleteSizeChart
);

export const SizeChartRoutes = router;

