import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ProductController } from "./product.controller";
import { createProductZodSchema, updateProductZodSchema } from "./product.validation";

const router = Router();

// Public Storefront Routes
router.get(
    "/",
    ProductController.getAllProducts
);

// Specific routes before /:idOrSlug to avoid route shadowing
router.get(
    "/shop-by-size",
    ProductController.getShopBySize
);

router.get(
    "/:idOrSlug",
    ProductController.getProductByIdOrSlug
);

// Admin & Manager Unified Management Routes
router.post(
    "/",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(createProductZodSchema),
    ProductController.createProduct
);

router.put(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    validateRequest(updateProductZodSchema),
    ProductController.updateProduct
);

router.delete(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    ProductController.deleteProduct
);

export const ProductRoutes = router;

