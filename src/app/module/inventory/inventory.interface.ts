import { StockMovementType } from "../../../generated/prisma/enums";

export interface IQuickStockUpdatePayload {
    variantId: string;
    newStockQuantity: number;
    showroomStock?: number;
    type?: StockMovementType;
    note?: string;
}

export interface IFactoryStockInItem {
    variantId: string;
    quantity: number;
    unitCostPrice?: number;
}

export interface IFactoryStockInPayload {
    items: IFactoryStockInItem[];
    shipmentReference?: string;
    note?: string;
}

