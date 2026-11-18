import { CourierProvider, DeliveryZone, FraudRiskLevel } from "../../../generated/prisma/enums";

export interface ICourierBookPayload {
    orderIds: string[];
    courierProvider: CourierProvider;
    note?: string;
}

export interface IBookedShipmentResult {
    orderId: string;
    orderNumber: string;
    consignmentId: string;
    trackingCode: string;
    trackingUrl: string;
    courierProvider: CourierProvider;
    codCollectibleAmount: number;
    status: string;
}

export interface IShippingZoneUpdatePayload {
    title?: string;
    charge?: number;
    freeShippingMinAmount?: number | null;
    estimatedDeliveryText?: string;
    isActive?: boolean;
}

export interface IFraudCheckResult {
    phoneNumber: string;
    totalParcels: number;
    deliveredCount: number;
    returnedCount: number;
    successRate: number;
    riskLevel: FraudRiskLevel;
    isBlacklisted: boolean;
    blacklistReason?: string | null;
    courierBreakdown?: Record<string, unknown> | null;
    recommendation: "ACCEPT_COD" | "REQUIRE_ADVANCE_DELIVERY_FEE" | "REJECT_ORDER";
}

export interface ISteadfastWebhookPayload {
    consignment_id?: string | number;
    tracking_code?: string;
    invoice?: string;
    status?: string;
    cod_amount?: number;
    delivery_charge?: number;
    cod_charge?: number;
    updated_at?: string;
    [key: string]: unknown;
}

export interface IPathaoWebhookPayload {
    consignment_id?: string;
    merchant_order_id?: string;
    order_status?: string;
    order_status_slug?: string;
    amount_to_collect?: number;
    collected_amount?: number;
    reason?: string;
    [key: string]: unknown;
}

