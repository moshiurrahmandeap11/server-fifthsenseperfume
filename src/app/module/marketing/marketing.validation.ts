import { z } from "zod";
import { DiscountType } from "../../../generated/prisma/enums";

export const applyCouponZodSchema = z.object({
    code: z.string().min(1, "Coupon code is required"),
    cartSubtotal: z.number().min(0, "Cart subtotal must be 0 or positive"),
    totalPairs: z.number().min(1, "Total pairs must be at least 1").optional(),
    isPrepaid: z.boolean().optional(),
});

export const createCouponZodSchema = z.object({
    code: z.string().min(2, "Code must be at least 2 characters"),
    description: z.string().optional(),
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.number().min(0.01, "Discount value must be greater than 0"),
    minOrderAmount: z.number().min(0).optional(),
    minPairCount: z.number().min(1).optional(),
    maxDiscountAmount: z.number().min(0).nullable().optional(),
    onlyPrepaid: z.boolean().optional(),
    startsAt: z.string().optional(),
    expiresAt: z.string().nullable().optional(),
    usageLimit: z.number().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
});

export const updateCouponZodSchema = z.object({
    code: z.string().min(2).optional(),
    description: z.string().optional(),
    discountType: z.nativeEnum(DiscountType).optional(),
    discountValue: z.number().min(0.01).optional(),
    minOrderAmount: z.number().min(0).optional(),
    minPairCount: z.number().min(1).optional(),
    maxDiscountAmount: z.number().min(0).nullable().optional(),
    onlyPrepaid: z.boolean().optional(),
    startsAt: z.string().optional(),
    expiresAt: z.string().nullable().optional(),
    usageLimit: z.number().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
});

export const createFlashSaleZodSchema = z.object({
    title: z.string().min(2, "Title is required"),
    titleBn: z.string().optional(),
    slug: z.string().optional(),
    bannerImage: z.string().optional(),
    startsAt: z.string().min(1, "startsAt is required"),
    endsAt: z.string().min(1, "endsAt is required"),
    isActive: z.boolean().optional(),
    items: z
        .array(
            z.object({
                productId: z.string().min(1, "productId is required"),
                flashSalePrice: z.number().min(0, "flashSalePrice must be positive"),
                sortOrder: z.number().optional(),
            })
        )
        .optional(),
});

export const updateFlashSaleZodSchema = z.object({
    title: z.string().min(2).optional(),
    titleBn: z.string().optional(),
    slug: z.string().optional(),
    bannerImage: z.string().optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    isActive: z.boolean().optional(),
    items: z
        .array(
            z.object({
                productId: z.string().min(1),
                flashSalePrice: z.number().min(0),
                sortOrder: z.number().optional(),
            })
        )
        .optional(),
});

export const createLandingPageZodSchema = z.object({
    title: z.string().min(2, "Title is required"),
    slug: z.string().optional(),
    productId: z.string().min(1, "productId is required"),
    headline: z.string().min(2, "Headline is required"),
    subheadline: z.string().optional(),
    heroVideoUrl: z.string().optional(),
    bannerImages: z.array(z.string()).optional(),
    featureBullets: z.array(z.string()).optional(),
    offerPrice: z.number().nullable().optional(),
    freeDelivery: z.boolean().optional(),
    showSizeChart: z.boolean().optional(),
    isActive: z.boolean().optional(),
});

export const updateLandingPageZodSchema = z.object({
    title: z.string().min(2).optional(),
    slug: z.string().optional(),
    productId: z.string().min(1).optional(),
    headline: z.string().min(2).optional(),
    subheadline: z.string().optional(),
    heroVideoUrl: z.string().optional(),
    bannerImages: z.array(z.string()).optional(),
    featureBullets: z.array(z.string()).optional(),
    offerPrice: z.number().nullable().optional(),
    freeDelivery: z.boolean().optional(),
    showSizeChart: z.boolean().optional(),
    isActive: z.boolean().optional(),
});

export const testCapiZodSchema = z.object({
    eventName: z.enum(["Purchase", "InitiateCheckout", "ViewContent", "AddToCart"]),
    orderId: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().optional(),
    amount: z.number().optional(),
    fbp: z.string().optional(),
    fbc: z.string().optional(),
});

export const MarketingValidation = {
    applyCouponZodSchema,
    createCouponZodSchema,
    updateCouponZodSchema,
    createFlashSaleZodSchema,
    updateFlashSaleZodSchema,
    createLandingPageZodSchema,
    updateLandingPageZodSchema,
    testCapiZodSchema,
};
