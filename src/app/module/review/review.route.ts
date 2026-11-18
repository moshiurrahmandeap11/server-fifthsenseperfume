import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth, parseUser } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ReviewController } from "./review.controller";
import { ReviewValidation } from "./review.validation";

const router = Router();

// 1. Submit a footwear review (Public / Customer)
router.post(
    "/",
    parseUser,
    validateRequest(ReviewValidation.createReviewZodSchema),
    ReviewController.createReview
);

// 2. Get approved reviews for a specific shoe product (Public)
router.get("/product/:productId", ReviewController.getProductReviews);

// 3. List all reviews for staff moderation (QueryBuilder)
router.get(
    "/",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    ReviewController.getAllReviews
);

// 4. Update review status (approve, feature, or reject)
router.put(
    "/:id/status",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.MODERATOR),
    validateRequest(ReviewValidation.updateReviewStatusZodSchema),
    ReviewController.updateReviewStatus
);

// 5. Delete spam review
router.delete(
    "/:id",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    ReviewController.deleteReview
);

export const ReviewRoutes = router;
