import { FitType, ProductGender, ProductStatus } from "../../../generated/prisma/enums";

export interface ICreateVariantInput {
    id?: string;
    size: string;
    ukSize?: string;
    usSize?: string;
    footLengthCm?: number;
    sku?: string;
    barcode?: string;
    stockQuantity: number;
    showroomStock?: number;
    lowStockThreshold?: number;
    priceOverride?: number;
    salePriceOverride?: number;
    isActive?: boolean;
}

export interface ICreateColorInput {
    id?: string;
    colorName: string;
    colorHex?: string;
    images: string[];
    videoUrl?: string;
    isDefault?: boolean;
    sortOrder?: number;
    variants: ICreateVariantInput[];
}

export interface ICreateProductPayload {
    name: string;
    nameBn?: string;
    slug?: string;
    styleCode: string;
    shortDescription?: string;
    description: string;
    specifications?: Record<string, unknown>;

    gender?: ProductGender;
    fitType?: FitType;
    upperMaterial?: string;
    soleMaterial?: string;
    insoleType?: string;
    heelHeight?: string;
    closureType?: string;
    warrantyDays?: number;

    costPrice: number;
    basePrice: number;
    discountPrice?: number;

    thumbnailUrl?: string;
    videoUrl?: string;

    status?: ProductStatus;
    isFeatured?: boolean;
    isNewArrival?: boolean;
    isBestSeller?: boolean;

    categoryId: string;
    sizeChartId?: string;

    crossSellProductIds?: string[];
    colors: ICreateColorInput[];
}

export interface IUpdateProductPayload extends Partial<ICreateProductPayload> {
    isBrokenSize?: boolean;
}

