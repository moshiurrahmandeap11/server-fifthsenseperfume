import { z } from "zod";
import { CourierProvider } from "../../../generated/prisma/enums";

export const bookCourierZodSchema = z.object({
    orderIds: z
        .array(z.string().min(1, "Order ID cannot be empty"))
        .min(1, "At least one orderId is required"),
    courierProvider: z.nativeEnum(CourierProvider),
    note: z.string().optional(),
});

export const updateShippingZoneZodSchema = z.object({
    title: z.string().min(1).optional(),
    charge: z.number().min(0, "Charge must be 0 or positive").optional(),
    freeShippingMinAmount: z.number().min(0).nullable().optional(),
    estimatedDeliveryText: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
});

export const CourierValidation = {
    bookCourierZodSchema,
    updateShippingZoneZodSchema,
};
