/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { FitType, OrderStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
    ICreateReviewPayload,
    IProductReviewsSummary,
    IUpdateReviewStatusPayload,
} from "./review.interface";

/**
 * Submit footwear review with size fit feedback & photos
 */
const createReview = async (payload: ICreateReviewPayload, userId?: string) => {
    const { productId, orderId, customerName, purchasedSize, rating, fitFeedback, comment, images } =
        payload;

    // 1. Verify target product exists
    const product = await prisma.product.findUnique({
        where: { id: productId },
    });

    if (!product) {
        throw new AppError(status.NOT_FOUND, "Target product not found");
    }

    // 2. Check if verified purchase (Order exists, is delivered, and contains this product)
    let isVerifiedPurchase = false;
    if (orderId) {
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                status: {
                    in: [OrderStatus.DELIVERED, OrderStatus.EXCHANGED],
                },
                items: {
                    some: {
                        productId,
                    },
                },
            },
        });

        if (order) {
            isVerifiedPurchase = true;
        }
    }

    // 3. Create review (moderation queue by default)
    const review = await prisma.review.create({
        data: {
            productId,
            userId: userId || null,
            orderId: orderId || null,
            customerName,
            purchasedSize: purchasedSize || null,
            rating,
            fitFeedback: fitFeedback || FitType.TRUE_TO_SIZE,
            comment,
            images: images || [],
            isVerifiedPurchase,
            isApproved: false,
            isFeatured: false,
        },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    styleCode: true,
                    thumbnailUrl: true,
                },
            },
        },
    });

    return review;
};

/**
 * Get approved reviews for a specific shoe product with ratings summary & fit breakdown
 */
const getProductReviews = async (productId: string, query: Record<string, any>) => {
    // 1. Compute product ratings & fit breakdown summary
    const approvedReviews = await prisma.review.findMany({
        where: {
            productId,
            isApproved: true,
        },
        select: {
            rating: true,
            fitFeedback: true,
        },
    });

    const totalReviews = approvedReviews.length;
    const averageRating =
        totalReviews > 0
            ? Number(
                  (
                      approvedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
                  ).toFixed(1)
              )
            : 0;

    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const fitBreakdown = {
        TRUE_TO_SIZE: 0,
        RUNS_SMALL: 0,
        RUNS_LARGE: 0,
        WIDE_FIT: 0,
    };

    approvedReviews.forEach((r) => {
        if (r.rating in ratingCounts) {
            ratingCounts[r.rating as 1 | 2 | 3 | 4 | 5]++;
        }
        if (r.fitFeedback in fitBreakdown) {
            fitBreakdown[r.fitFeedback as keyof typeof fitBreakdown]++;
        }
    });

    const summary: IProductReviewsSummary = {
        averageRating,
        totalReviews,
        ratingCounts,
        fitBreakdown,
    };

    // 2. Fetch paginated list using QueryBuilder
    const queryBuilder = new QueryBuilder(prisma.review, query, {
        searchableFields: ["comment", "customerName"],
        filterableFields: ["rating", "fitFeedback", "isVerifiedPurchase"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    queryBuilder.where({
        productId,
        isApproved: true,
    });

    const result = await queryBuilder.execute();

    return {
        summary,
        ...result,
    };
};

/**
 * List all reviews for staff moderation with QueryBuilder
 */
const getAllReviews = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.review, query, {
        searchableFields: ["customerName", "comment"],
        filterableFields: [
            "productId",
            "rating",
            "isApproved",
            "isFeatured",
            "isVerifiedPurchase",
            "fitFeedback",
        ],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    queryBuilder.include({
        product: {
            select: {
                id: true,
                name: true,
                styleCode: true,
                thumbnailUrl: true,
            },
        },
    });

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Update review status (approve, reject, or feature on homepage)
 */
const updateReviewStatus = async (id: string, payload: IUpdateReviewStatusPayload) => {
    const existing = await prisma.review.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Review with ID '${id}' not found`);
    }

    const updated = await prisma.review.update({
        where: { id },
        data: {
            isApproved: payload.isApproved !== undefined ? payload.isApproved : existing.isApproved,
            isFeatured: payload.isFeatured !== undefined ? payload.isFeatured : existing.isFeatured,
        },
    });

    return updated;
};

/**
 * Delete a review (spam / inappropriate)
 */
const deleteReview = async (id: string) => {
    const existing = await prisma.review.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Review with ID '${id}' not found`);
    }

    await prisma.review.delete({
        where: { id },
    });

    return { message: "Review deleted successfully" };
};

export const ReviewService = {
    createReview,
    getProductReviews,
    getAllReviews,
    updateReviewStatus,
    deleteReview,
};

