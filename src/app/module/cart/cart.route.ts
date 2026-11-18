import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CartController } from "./cart.controller";
import { CartValidation } from "./cart.validation";

const router = Router();

const allRoles = [
    Role.CUSTOMER,
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.MANAGER,
    Role.MODERATOR,
    Role.INVENTORY_STAFF,
    Role.ACCOUNTANT,
];

// 1. Get Logged-in Customer's Persistent Cart with Live Stock Check
router.get("/", checkAuth(...allRoles), CartController.getUserCart);

// 2. Add Footwear Size Variant to Cart
router.post(
    "/items",
    checkAuth(...allRoles),
    validateRequest(CartValidation.addToCartZodSchema),
    CartController.addItemToCart
);

// 3. Update Item Quantity in Cart
router.put(
    "/items/:id",
    checkAuth(...allRoles),
    validateRequest(CartValidation.updateCartItemZodSchema),
    CartController.updateCartItem
);

// 4. Remove Item from Cart
router.delete("/items/:id", checkAuth(...allRoles), CartController.removeCartItem);

// 5. Clear Entire Cart
router.delete("/", checkAuth(...allRoles), CartController.clearCart);

// 6. Hybrid Sync: Merge guest LocalStorage cart upon login
router.post(
    "/sync",
    checkAuth(...allRoles),
    validateRequest(CartValidation.syncCartZodSchema),
    CartController.syncCart
);

export const CartRoutes = router;

