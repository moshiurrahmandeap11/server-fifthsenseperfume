import { z } from "zod";

export const toggleWishlistZodSchema = z.object({
    productId: z.string().min(1, "productId is required"),
});

export const WishlistValidation = {
    toggleWishlistZodSchema,
};
