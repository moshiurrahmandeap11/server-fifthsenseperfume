import { ExchangeStatus, ExchangeType, ReturnQcStatus } from "../../../generated/prisma/enums";

export interface ICreateExchangeRequestPayload {
    orderId: string;
    orderItemId: string;
    oldVariantId: string;
    newVariantId?: string;
    type?: ExchangeType;
    reason: string;
    customerImages?: string[];
}

export interface IExchangeStatusDecisionPayload {
    status: ExchangeStatus;
    exchangeDeliveryFee?: number;
    isBrandBearingCost?: boolean;
    rejectionReason?: string;
    adminNote?: string;
    courierNote?: string;
}

export interface IExchangeQcDecisionPayload {
    decision: ReturnQcStatus;
    receivedCondition?: string;
    note?: string;
}

