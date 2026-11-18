import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { WishlistController } from "./wishlist.controller";
import { WishlistValidation } from "./wishlist.validation";

const router = Router();

// 1. Toggle Product in Wishlist (Authenticated User / Customer)
router.post(
    "/toggle",
    checkAuth(
        Role.CUSTOMER,
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.MODERATOR
    ),
    validateRequest(WishlistValidation.toggleWishlistZodSchema),
    WishlistController.toggleWishlist
);

// 2. Get Customer's Wishlist Items
router.get(
    "/",
    checkAuth(
        Role.CUSTOMER,
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.MODERATOR
    ),
    WishlistController.getUserWishlist
);

export const WishlistRoutes = router;

