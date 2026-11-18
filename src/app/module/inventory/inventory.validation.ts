import { z } from "zod";

const StockMovementTypes = [
    "FACTORY_IN",
    "ORDER_DEDUCT",
    "ORDER_CANCEL_RESTOCK",
    "EXCHANGE_RESERVE",
    "RETURN_QC_RESTOCK",
    "DAMAGED",
    "MANUAL_ADJUSTMENT",
    "SHOWROOM_SYNC",
] as const;

export const quickStockUpdateZodSchema = z.object({
    variantId: z.string().uuid("Invalid variant ID"),
    newStockQuantity: z.coerce.number().int().min(0, "Stock quantity cannot be negative"),
    showroomStock: z.coerce.number().int().min(0).optional(),
    type: z.enum(StockMovementTypes).optional(),
    note: z.string().max(250).optional(),
});

export const factoryStockInZodSchema = z.object({
    items: z.array(
        z.object({
            variantId: z.string().uuid("Invalid variant ID"),
            quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
            unitCostPrice: z.coerce.number().min(0).optional(),
        })
    ).min(1, "At least one item is required for factory stock-in"),
    shipmentReference: z.string().max(100).optional(),
    note: z.string().max(300).optional(),
});

