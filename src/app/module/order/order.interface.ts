import { DeliveryZone, OrderSource, OrderStatus, PaymentMethod } from "../../../generated/prisma/enums";

export interface ICheckoutItemInput {
    variantId: string;
    quantity: number;
}

export interface ICheckoutPayload {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    shippingAddress: string;
    division: string;
    district: string;
    thana: string;
    deliveryZone?: DeliveryZone;
    paymentMethod?: PaymentMethod;
    source?: OrderSource;
    couponCode?: string;
    customerNote?: string;
    items: ICheckoutItemInput[];
    fbp?: string;
    fbc?: string;
}

export interface IIncompleteOrderPayload {
    sessionKey?: string;
    customerName?: string;
    customerPhone: string;
    customerEmail?: string;
    shippingAddress?: string;
    division?: string;
    district?: string;
    thana?: string;
    itemsJson: unknown;
    totalAmount?: number;
    source?: OrderSource;
}

export interface IUpdateOrderStatusPayload {
    status: OrderStatus;
    note?: string;
    tag?: string;
    cancelReason?: string;
}

export interface IUpdateOrderPayload {
    customerName?: string;
    customerPhone?: string;
    shippingAddress?: string;
    division?: string;
    district?: string;
    thana?: string;
    adminNote?: string;
    items?: Array<{
        variantId: string;
        quantity: number;
        unitPrice?: number;
    }>;
}

export interface IBulkStatusPayload {
    orderIds: string[];
    newStatus: OrderStatus;
    note?: string;
}

export interface IScanVerifyPackPayload {
    orderId: string;
    scannedBarcode: string;
}

