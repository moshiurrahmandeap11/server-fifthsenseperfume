import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { uploadSingle } from "../../config/multer.config";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CategoryController } from "./category.controller";
import { createCategoryZodSchema, updateCategoryZodSchema } from "./category.validation";

const router = Router();

// Public Storefront Routes
router.get(
    "/",
    CategoryController.getAllCategories
);

router.get(
    "/:idOrSlug",
    CategoryController.getCategoryByIdOrSlug
);

// Admin & Manager Management Routes
router.post(
    "/",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    uploadSingle("image"),
    validateRequest(createCategoryZodSchema),
    CategoryController.createCategory
);

router.put(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    uploadSingle("image"),
    validateRequest(updateCategoryZodSchema),
    CategoryController.updateCategory
);

router.delete(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    CategoryController.deleteCategory
);

export const CategoryRoutes = router;

