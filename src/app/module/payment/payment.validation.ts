import { z } from "zod";
import {
    ExpenseCategory,
    PaymentMethod,
    PaymentTransactionType,
} from "../../../generated/prisma/enums";

export const initiatePaymentZodSchema = z.object({
    orderId: z.string().min(1, "Order ID is required"),
    method: z.nativeEnum(PaymentMethod, {
        error: "Valid payment method is required (BKASH, SSLCOMMERZ, etc.)",
    }),
    transactionType: z.nativeEnum(PaymentTransactionType, {
        error: "Valid transaction type is required (ADVANCE_DELIVERY_FEE, FULL_PREPAID)",
    }),
    callbackUrl: z.string().url("Invalid callback URL").optional(),
});

export const bkashCallbackZodSchema = z.object({
    paymentID: z.string().min(1, "paymentID is required"),
    status: z.string().min(1, "status is required"),
});

export const sslcommerzCallbackZodSchema = z
    .object({
        tran_id: z.string().min(1, "tran_id is required"),
    })
    .passthrough();

export const markReconciledZodSchema = z.object({
    shipmentIds: z
        .array(z.string().min(1, "Shipment ID cannot be empty"))
        .min(1, "At least one shipmentId is required"),
    note: z.string().optional(),
});

export const createExpenseZodSchema = z.object({
    category: z.nativeEnum(ExpenseCategory, {
        error: "Valid expense category is required",
    }),
    title: z.string().min(2, "Title must be at least 2 characters"),
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    date: z.string().min(1, "Date is required"),
    note: z.string().optional(),
});

export const updateExpenseZodSchema = z.object({
    category: z.nativeEnum(ExpenseCategory).optional(),
    title: z.string().min(2).optional(),
    amount: z.number().min(0.01).optional(),
    date: z.string().optional(),
    note: z.string().optional(),
});

export const PaymentValidation = {
    initiatePaymentZodSchema,
    bkashCallbackZodSchema,
    sslcommerzCallbackZodSchema,
    markReconciledZodSchema,
    createExpenseZodSchema,
    updateExpenseZodSchema,
};
