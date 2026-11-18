import { z } from "zod";
import { ExchangeStatus, ExchangeType, ReturnQcStatus } from "../../../generated/prisma/enums";

export const createExchangeRequestZodSchema = z.object({
    orderId: z.string().min(1, "Order ID is required"),
    orderItemId: z.string().min(1, "Order Item ID is required"),
    oldVariantId: z.string().min(1, "Current Variant ID is required"),
    newVariantId: z.string().optional(),
    type: z.nativeEnum(ExchangeType).optional(),
    reason: z.string().min(5, "Please provide a detailed reason (at least 5 characters)"),
    customerImages: z.array(z.string()).optional(),
});

export const exchangeStatusDecisionZodSchema = z.object({
    status: z.nativeEnum(ExchangeStatus),
    exchangeDeliveryFee: z.number().min(0, "Delivery fee must be 0 or positive").optional(),
    isBrandBearingCost: z.boolean().optional(),
    rejectionReason: z.string().optional(),
    adminNote: z.string().optional(),
    courierNote: z.string().optional(),
});

export const exchangeQcDecisionZodSchema = z.object({
    decision: z.nativeEnum(ReturnQcStatus),
    receivedCondition: z.string().optional(),
    note: z.string().optional(),
});

export const ExchangeValidation = {
    createExchangeRequestZodSchema,
    exchangeStatusDecisionZodSchema,
    exchangeQcDecisionZodSchema,
};
