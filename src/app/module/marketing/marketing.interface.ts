import { DiscountType } from "../../../generated/prisma/enums";

export interface IApplyCouponPayload {
    code: string;
    cartSubtotal: number;
    totalPairs?: number;
    isPrepaid?: boolean;
}

export interface IApplyCouponResult {
    isValid: boolean;
    couponId: string;
    code: string;
    discountType: DiscountType;
    discountValue: number;
    discountAmount: number;
    finalPayable: number;
    message?: string;
}

export interface ICreateCouponPayload {
    code: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount?: number;
    minPairCount?: number;
    maxDiscountAmount?: number | null;
    onlyPrepaid?: boolean;
    startsAt?: string | Date;
    expiresAt?: string | Date | null;
    usageLimit?: number | null;
    isActive?: boolean;
}

export interface IUpdateCouponPayload {
    code?: string;
    description?: string;
    discountType?: DiscountType;
    discountValue?: number;
    minOrderAmount?: number;
    minPairCount?: number;
    maxDiscountAmount?: number | null;
    onlyPrepaid?: boolean;
    startsAt?: string | Date;
    expiresAt?: string | Date | null;
    usageLimit?: number | null;
    isActive?: boolean;
}

export interface IFlashSaleItemInput {
    productId: string;
    flashSalePrice: number;
    sortOrder?: number;
}

export interface ICreateFlashSalePayload {
    title: string;
    titleBn?: string;
    slug?: string;
    bannerImage?: string;
    startsAt: string | Date;
    endsAt: string | Date;
    isActive?: boolean;
    items?: IFlashSaleItemInput[];
}

export interface IUpdateFlashSalePayload {
    title?: string;
    titleBn?: string;
    slug?: string;
    bannerImage?: string;
    startsAt?: string | Date;
    endsAt?: string | Date;
    isActive?: boolean;
    items?: IFlashSaleItemInput[];
}

export interface ICreateLandingPagePayload {
    title: string;
    slug?: string;
    productId: string;
    headline: string;
    subheadline?: string;
    heroVideoUrl?: string;
    bannerImages?: string[];
    featureBullets?: string[];
    offerPrice?: number | null;
    freeDelivery?: boolean;
    showSizeChart?: boolean;
    isActive?: boolean;
}

export interface IUpdateLandingPagePayload {
    title?: string;
    slug?: string;
    productId?: string;
    headline?: string;
    subheadline?: string;
    heroVideoUrl?: string;
    bannerImages?: string[];
    featureBullets?: string[];
    offerPrice?: number | null;
    freeDelivery?: boolean;
    showSizeChart?: boolean;
    isActive?: boolean;
}

export interface ITestCapiPayload {
    eventName: "Purchase" | "InitiateCheckout" | "ViewContent" | "AddToCart";
    orderId?: string;
    customerPhone?: string;
    customerEmail?: string;
    amount?: number;
    fbp?: string;
    fbc?: string;
}

