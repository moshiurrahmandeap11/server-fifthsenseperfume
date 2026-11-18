import { FitType } from "../../../generated/prisma/enums";

export interface ICreateReviewPayload {
    productId: string;
    orderId?: string;
    customerName: string;
    purchasedSize?: string;
    rating: number;
    fitFeedback?: FitType;
    comment: string;
    images?: string[];
}

export interface IUpdateReviewStatusPayload {
    isApproved?: boolean;
    isFeatured?: boolean;
}

export interface IProductReviewsSummary {
    averageRating: number;
    totalReviews: number;
    ratingCounts: {
        5: number;
        4: number;
        3: number;
        2: number;
        1: number;
    };
    fitBreakdown: {
        TRUE_TO_SIZE: number;
        RUNS_SMALL: number;
        RUNS_LARGE: number;
        WIDE_FIT: number;
    };
}

