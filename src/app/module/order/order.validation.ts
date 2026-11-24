import { z } from "zod";

const DeliveryZones = ["INSIDE_DHAKA", "DHAKA_SUB_AREA", "OUTSIDE_DHAKA"] as const;
const PaymentMethods = ["COD", "BKASH", "NAGAD", "ROCKET", "SSLCOMMERZ", "AAMARPAY"] as const;
const OrderSources = ["WEBSITE", "AD_LANDING_PAGE", "WHATSAPP", "MESSENGER", "PHONE_CALL", "EXCHANGE_REPLACEMENT"] as const;
const OrderStatuses = [
    "PENDING",
    "ON_HOLD",
    "CONFIRMED",
    "PACKED",
    "SHIPPED",
    "IN_TRANSIT",
    "DELIVERED",
    "PARTIAL_DELIVERED",
    "CANCELLED",
    "RETURNED",
    "EXCHANGE_REQUESTED",
    "EXCHANGED",
] as const;

export const checkoutZodSchema = z.object({
    customerName: z.string().min(2, "Customer name must be at least 2 characters"),
    customerPhone: z.string().min(10, "Phone number must be at least 10 digits"),
    customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
    shippingAddress: z.string().min(5, "Delivery address must be at least 5 characters"),
    division: z.string().min(2, "Division is required"),
    district: z.string().min(2, "District is required"),
    thana: z.string().min(2, "Thana is required"),
    deliveryZone: z.enum(DeliveryZones).optional(),
    paymentMethod: z.enum(PaymentMethods).optional(),
    source: z.enum(OrderSources).optional(),
    couponCode: z.string().optional(),
    redeemPoints: z.coerce.number().int().min(0).optional(),
    customerNote: z.string().max(300).optional(),
    items: z.array(
        z.object({
            variantId: z.string().uuid("Invalid variant ID"),
            quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
        })
    ).min(1, "Order must contain at least one shoe item"),
    fbp: z.string().optional(),
    fbc: z.string().optional(),
});

export const incompleteCaptureZodSchema = z.object({
    sessionKey: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().min(10, "Phone number must be at least 10 digits"),
    customerEmail: z.string().email().optional(),
    shippingAddress: z.string().optional(),
    division: z.string().optional(),
    district: z.string().optional(),
    thana: z.string().optional(),
    itemsJson: z.unknown(),
    totalAmount: z.coerce.number().min(0).optional(),
    source: z.enum(OrderSources).optional(),
});

export const updateOrderStatusZodSchema = z.object({
    status: z.enum(OrderStatuses),
    note: z.string().max(300).optional(),
    tag: z.string().optional(),
    cancelReason: z.string().max(250).optional(),
});

export const updateOrderZodSchema = z.object({
    customerName: z.string().min(2).optional(),
    customerPhone: z.string().min(10).optional(),
    shippingAddress: z.string().min(5).optional(),
    division: z.string().optional(),
    district: z.string().optional(),
    thana: z.string().optional(),
    adminNote: z.string().max(500).optional(),
    items: z.array(
        z.object({
            variantId: z.string().uuid(),
            quantity: z.coerce.number().int().min(1),
            unitPrice: z.coerce.number().min(0).optional(),
        })
    ).optional(),
});

export const bulkStatusZodSchema = z.object({
    orderIds: z.array(z.string().uuid()).min(1, "At least one order ID is required"),
    newStatus: z.enum(OrderStatuses),
    note: z.string().max(250).optional(),
});

export const scanVerifyPackZodSchema = z.object({
    orderId: z.string().uuid("Invalid order ID"),
    scannedBarcode: z.string().min(1, "Scanned barcode is required"),
});

