import { z } from "zod";

const DeliveryZones = ["INSIDE_DHAKA", "DHAKA_SUB_AREA", "OUTSIDE_DHAKA"] as const;

export const updateProfileZodSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be at most 50 characters").optional(),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    birthdate: z.string().datetime({ message: "Invalid birthdate format (ISO string expected)" }).optional(),
    address: z.string().optional(),
    savedShoeSize: z.string().optional(),
    bio: z.string().max(250, "Bio must be at most 250 characters").optional(),
    image: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

export const createAddressZodSchema = z.object({
    label: z.string().optional(),
    recipientName: z.string().min(2, "Recipient name must be at least 2 characters"),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
    division: z.string().min(2, "Division is required"),
    district: z.string().min(2, "District is required"),
    thana: z.string().min(2, "Thana is required"),
    fullAddress: z.string().min(5, "Full address must be at least 5 characters"),
    deliveryZone: z.enum(DeliveryZones).optional(),
    isDefault: z.boolean().optional(),
});

export const updateAddressZodSchema = z.object({
    label: z.string().optional(),
    recipientName: z.string().min(2, "Recipient name must be at least 2 characters").optional(),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional(),
    division: z.string().min(2, "Division is required").optional(),
    district: z.string().min(2, "District is required").optional(),
    thana: z.string().min(2, "Thana is required").optional(),
    fullAddress: z.string().min(5, "Full address must be at least 5 characters").optional(),
    deliveryZone: z.enum(DeliveryZones).optional(),
    isDefault: z.boolean().optional(),
});
