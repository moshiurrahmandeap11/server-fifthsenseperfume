import { z } from "zod";
import { FitType } from "../../../generated/prisma/enums";

export const createReviewZodSchema = z.object({
    productId: z.string().min(1, "productId is required"),
    orderId: z.string().optional(),
    customerName: z.string().min(2, "Customer name must be at least 2 characters"),
    purchasedSize: z.string().optional(),
    rating: z
        .number()
        .int()
        .min(1, "Rating must be at least 1")
        .max(5, "Rating cannot exceed 5"),
    fitFeedback: z.nativeEnum(FitType).optional(),
    comment: z.string().min(3, "Review comment must be at least 3 characters"),
    images: z.array(z.string()).optional(),
});

export const updateReviewStatusZodSchema = z.object({
    isApproved: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
});

export const ReviewValidation = {
    createReviewZodSchema,
    updateReviewStatusZodSchema,
};
