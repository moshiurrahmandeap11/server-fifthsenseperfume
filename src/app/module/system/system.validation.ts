import { z } from "zod";
import { BannerPosition } from "../../../generated/prisma/enums";

export const updatePlatformSettingsZodSchema = z.object({
    brandName: z.string().min(1).optional(),
    brandNameBn: z.string().optional(),
    brandSlug: z.string().optional(),
    tagline: z.string().optional(),
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    footerDescription: z.string().optional(),
    supportPhone: z.string().optional(),
    whatsappNumber: z.string().optional(),
    messengerLink: z.string().optional(),
    announcementText: z.string().optional(),
    announcementTextBn: z.string().optional(),
    insideDhakaShipping: z.coerce.number().min(0).optional(),
    dhakaSubAreaShipping: z.coerce.number().min(0).optional(),
    outsideDhakaShipping: z.coerce.number().min(0).optional(),
    freeShippingThreshold: z.coerce.number().min(0).nullable().optional(),
    enabledPaymentMethods: z
        .array(
            z.enum([
                "COD",
                "BKASH",
                "NAGAD",
                "ROCKET",
                "SSLCOMMERZ",
                "AAMARPAY",
            ])
        )
        .min(1, "At least one payment method must be enabled")
        .optional(),
    metaPixelId: z.string().optional(),
    metaCapiAccessToken: z.string().optional(),
    sendCapiOnConfirmOnly: z.coerce.boolean().optional(),
    tiktokPixelId: z.string().optional(),
    exchangeWindowDays: z.coerce.number().int().min(1).optional(),
    maintenanceMode: z.coerce.boolean().optional(),
});

export const createBannerZodSchema = z.object({
    title: z.string().min(1, "Title is required"),
    titleBn: z.string().optional(),
    subtitle: z.string().optional(),
    subtitleBn: z.string().optional(),
    imageUrl: z.string().optional(),
    mobileImgUrl: z.string().optional(),
    ctaText: z.string().optional(),
    ctaLink: z.string().optional(),
    position: z.nativeEnum(BannerPosition).optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.coerce.boolean().optional(),
});

export const updateBannerZodSchema = z.object({
    title: z.string().min(1).optional(),
    titleBn: z.string().optional(),
    subtitle: z.string().optional(),
    subtitleBn: z.string().optional(),
    imageUrl: z.string().optional(),
    mobileImgUrl: z.string().optional(),
    ctaText: z.string().optional(),
    ctaLink: z.string().optional(),
    position: z.nativeEnum(BannerPosition).optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.coerce.boolean().optional(),
});

export const createShowroomZodSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    district: z.string().min(2, "District is required"),
    thana: z.string().min(2, "Thana is required"),
    fullAddress: z.string().min(5, "Full address must be at least 5 characters"),
    phoneNumber: z.string().min(11, "Valid contact number is required"),
    googleMapUrl: z.string().optional(),
    openingHours: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
});

export const updateShowroomZodSchema = z.object({
    name: z.string().min(2).optional(),
    district: z.string().min(2).optional(),
    thana: z.string().min(2).optional(),
    fullAddress: z.string().min(5).optional(),
    phoneNumber: z.string().min(11).optional(),
    googleMapUrl: z.string().optional(),
    openingHours: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
});

export const SystemValidation = {
    updatePlatformSettingsZodSchema,
    createBannerZodSchema,
    updateBannerZodSchema,
    createShowroomZodSchema,
    updateShowroomZodSchema,
};
