export interface IAddToCartPayload {
    variantId: string;
    quantity?: number;
}

export interface IUpdateCartItemPayload {
    quantity: number;
}

export interface ISyncCartItemInput {
    variantId: string;
    quantity: number;
}

export interface ISyncCartPayload {
    items: ISyncCartItemInput[];
}

export interface ICartItemDetails {
    id: string;
    variantId: string;
    productId: string;
    productName: string;
    slug: string;
    styleCode: string;
    colorName: string;
    size: string;
    sku: string;
    imageUrl: string;
    unitPrice: number;
    originalPrice?: number;
    quantity: number;
    itemTotal: number;
    stockAvailable: number;
    isAvailable: boolean;
    isOutOfStock: boolean;
}

export interface ICartResponse {
    cartId: string;
    items: ICartItemDetails[];
    subtotal: number;
    totalQuantity: number;
    totalItems: number;
    hasOutOfStockItems: boolean;
}

