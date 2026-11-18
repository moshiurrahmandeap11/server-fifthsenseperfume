import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { uploadProfilePhoto } from "../../config/multer.config";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { createAddressZodSchema, updateAddressZodSchema, updateProfileZodSchema } from "./user.validation";

const router = Router();

// Customer Profile Routes
router.get(
    "/profile",
    checkAuth(),
    UserController.getMyProfile
);

router.put(
    "/profile",
    checkAuth(),
    uploadProfilePhoto,
    validateRequest(updateProfileZodSchema),
    UserController.updateMyProfile
);

// Customer Address Book Routes
router.get(
    "/addresses",
    checkAuth(),
    UserController.getMyAddresses
);

router.post(
    "/addresses",
    checkAuth(),
    validateRequest(createAddressZodSchema),
    UserController.createAddress
);

router.put(
    "/addresses/:id",
    checkAuth(),
    validateRequest(updateAddressZodSchema),
    UserController.updateAddress
);

router.delete(
    "/addresses/:id",
    checkAuth(),
    UserController.deleteAddress
);

// CRM Customer Management Routes (Super Admin, Admin, Moderator)
router.get(
    "/customers",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    UserController.getAllCustomers
);

router.get(
    "/customers/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MODERATOR),
    UserController.getCustomerById
);

export const UserRoutes = router;
