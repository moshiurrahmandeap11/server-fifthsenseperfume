import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { uploadMultiple, uploadSingle } from "../../config/multer.config";
import { checkAuth } from "../../middleware/checkAuth";
import { MediaController } from "./media.controller";

const router = Router();

router.post(
    "/upload",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.INVENTORY_STAFF),
    uploadSingle("file"),
    MediaController.uploadSingleImage
);

router.post(
    "/upload-multiple",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.INVENTORY_STAFF),
    uploadMultiple("files", 10),
    MediaController.uploadMultipleImages
);

router.post(
    "/delete",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER),
    MediaController.deleteImage
);

export const MediaRoutes = router;
