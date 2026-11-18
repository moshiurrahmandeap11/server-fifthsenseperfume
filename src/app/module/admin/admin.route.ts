import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import { blacklistZodSchema, createStaffZodSchema, updateStaffZodSchema } from "./admin.validation";

const router = Router();

// Staff Management Routes (Super Admin & Admin)
router.get(
    "/staff",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    AdminController.getAllStaff
);

router.post(
    "/staff",
    checkAuth(Role.SUPER_ADMIN),
    validateRequest(createStaffZodSchema),
    AdminController.createStaff
);

router.get(
    "/staff/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    AdminController.getStaffById
);

router.put(
    "/staff/:id",
    checkAuth(Role.SUPER_ADMIN),
    validateRequest(updateStaffZodSchema),
    AdminController.updateStaff
);

router.delete(
    "/staff/:id",
    checkAuth(Role.SUPER_ADMIN),
    AdminController.deleteStaff
);

// Staff Audit Activity Logs (Super Admin & Admin)
router.get(
    "/activity-logs",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    AdminController.getActivityLogs
);

// Customer Fraud & Blacklist Routes (Super Admin, Admin & Moderator)
router.get(
    "/blacklist",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    AdminController.getBlacklist
);

router.post(
    "/blacklist",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    validateRequest(blacklistZodSchema),
    AdminController.addToBlacklist
);

router.delete(
    "/blacklist/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    AdminController.removeFromBlacklist
);

export const AdminRoutes = router;
