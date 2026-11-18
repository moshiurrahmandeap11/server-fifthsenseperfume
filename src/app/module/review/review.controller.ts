import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ReviewService } from "./review.service";

const createReview = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const result = await ReviewService.createReview(req.body, userId);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Review submitted successfully and sent for moderation",
        data: result,
    });
});

const getProductReviews = catchAsync(async (req: Request, res: Response) => {
    const productId = req.params.productId as string;
    const result = await ReviewService.getProductReviews(productId, req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Product reviews and fit feedback retrieved successfully",
        meta: result.meta,
        data: {
            summary: result.summary,
            reviews: result.data,
        },
    });
});

const getAllReviews = catchAsync(async (req: Request, res: Response) => {
    const result = await ReviewService.getAllReviews(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "All reviews retrieved successfully for moderation",
        meta: result.meta,
        data: result.data,
    });
});

const updateReviewStatus = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await ReviewService.updateReviewStatus(id, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Review status updated successfully",
        data: result,
    });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await ReviewService.deleteReview(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
    });
});

export const ReviewController = {
    createReview,
    getProductReviews,
    getAllReviews,
    updateReviewStatus,
    deleteReview,
};

