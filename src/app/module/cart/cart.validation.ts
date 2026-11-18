import { z } from "zod";

export const addToCartZodSchema = z.object({
    variantId: z.string().min(1, "variantId is required"),
    quantity: z.number().int().min(1, "Quantity must be at least 1").optional().default(1),
});

export const updateCartItemZodSchema = z.object({
    quantity: z.number().int().min(0, "Quantity must be 0 or positive"),
});

export const syncCartZodSchema = z.object({
    items: z
        .array(
            z.object({
                variantId: z.string().min(1, "variantId is required"),
                quantity: z.number().int().min(1, "Quantity must be at least 1"),
            })
        )
        .min(0),
});

export const CartValidation = {
    addToCartZodSchema,
    updateCartItemZodSchema,
    syncCartZodSchema,
};
