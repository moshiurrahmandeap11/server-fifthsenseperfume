import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { InventoryController } from "./inventory.controller";
import { factoryStockInZodSchema, quickStockUpdateZodSchema } from "./inventory.validation";

const router = Router();

// Size Matrix Grid View (Admin, Manager & Inventory Staff)
router.get(
    "/size-matrix",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.INVENTORY_STAFF),
    InventoryController.getSizeMatrix
);

// 1-Click Quick Stock Adjustment
router.put(
    "/quick-update",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.INVENTORY_STAFF),
    validateRequest(quickStockUpdateZodSchema),
    InventoryController.quickStockUpdate
);

// Low-stock & Broken-size Alerts
router.get(
    "/low-stock-alerts",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.INVENTORY_STAFF),
    InventoryController.getLowStockAlerts
);

// Stock Movement Audit History (Includes Accountant for inventory valuation)
router.get(
    "/movements",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.INVENTORY_STAFF, Role.ACCOUNTANT),
    InventoryController.getStockMovements
);

// Bulk Factory Shipment Stock-In
router.post(
    "/factory-stock-in",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.INVENTORY_STAFF),
    validateRequest(factoryStockInZodSchema),
    InventoryController.factoryStockIn
);

// Shoe Box Barcode Label Print Data
router.get(
    "/barcode-label/:variantId",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.INVENTORY_STAFF),
    InventoryController.getBarcodeLabel
);

export const InventoryRoutes = router;

