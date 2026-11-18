import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, parseUser } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrderController } from "./order.controller";
import {
    bulkStatusZodSchema,
    checkoutZodSchema,
    incompleteCaptureZodSchema,
    scanVerifyPackZodSchema,
    updateOrderStatusZodSchema,
    updateOrderZodSchema,
} from "./order.validation";

const router = Router();

// 1. Storefront Checkout & Tracking (Public / Customer)
router.post(
    "/checkout",
    parseUser,
    validateRequest(checkoutZodSchema),
    OrderController.checkoutOrder
);

router.post(
    "/incomplete-capture",
    validateRequest(incompleteCaptureZodSchema),
    OrderController.incompleteCapture
);

router.get(
    "/track-public",
    OrderController.trackPublicOrder
);

// 2. Call Center & Incomplete Order Recovery
router.get(
    "/incomplete",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    OrderController.getIncompleteOrders
);

router.post(
    "/incomplete/:id/convert",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    validateRequest(checkoutZodSchema),
    OrderController.convertIncompleteOrder
);

// 3. Staff Order Operations
router.get(
    "/",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.MODERATOR,
        Role.INVENTORY_STAFF,
        Role.ACCOUNTANT
    ),
    OrderController.getAllOrders
);

router.post(
    "/",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    validateRequest(checkoutZodSchema),
    OrderController.createManualOrder
);

router.put(
    "/bulk-status",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    validateRequest(bulkStatusZodSchema),
    OrderController.bulkStatusUpdate
);

router.post(
    "/scan-verify-pack",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.INVENTORY_STAFF),
    validateRequest(scanVerifyPackZodSchema),
    OrderController.scanVerifyPack
);

// 4. Parameterized Single Order Routes
router.get(
    "/:id",
    checkAuth(),
    OrderController.getOrderById
);

router.put(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    validateRequest(updateOrderZodSchema),
    OrderController.updateOrder
);

router.put(
    "/:id/status",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    validateRequest(updateOrderStatusZodSchema),
    OrderController.updateOrderStatus
);

export const OrderRoutes = router;

