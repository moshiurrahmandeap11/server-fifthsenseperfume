import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CourierController } from "./courier.controller";
import { CourierValidation } from "./courier.validation";

const router = Router();

// 1. Live Shipping Zones (Public & Staff)
router.get("/shipping-zones", CourierController.getShippingZones);

// 2. Update Shipping Zone Rule (Admin, Super Admin)
router.put(
    "/shipping-zones/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    validateRequest(CourierValidation.updateShippingZoneZodSchema),
    CourierController.updateShippingZone
);

// 3. Customer Fraud & Delivery Ratio Check (Moderator, Manager, Admin, Super Admin)
router.get(
    "/check-fraud/:phone",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    CourierController.checkFraud
);

// 4. Unified Courier Booking: Single or Bulk dispatch (Moderator, Manager, Admin, Super Admin)
router.post(
    "/book",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    validateRequest(CourierValidation.bookCourierZodSchema),
    CourierController.bookCourier
);

// 5. Courier Shipments Directory (QueryBuilder: filter, search, pagination)
router.get(
    "/shipments",
    checkAuth(
        Role.SUPER_ADMIN,
        Role.ADMIN,
        Role.MANAGER,
        Role.MODERATOR,
        Role.ACCOUNTANT,
        Role.INVENTORY_STAFF
    ),
    CourierController.getAllShipments
);

// 6. Track Shipment (Public / Customer / Staff)
router.get("/track/:idOrCode", CourierController.trackShipment);

// 7. Steadfast Courier Automated Webhook
router.post("/webhook/steadfast", CourierController.handleSteadfastWebhook);

// 8. Pathao Courier Automated Webhook
router.post("/webhook/pathao", CourierController.handlePathaoWebhook);

export const CourierRoutes = router;
