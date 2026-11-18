import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { WishlistService } from "./wishlist.service";

const toggleWishlist = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(status.UNAUTHORIZED, "Please log in to manage your wishlist");
    }

    const { productId } = req.body;
    const result = await WishlistService.toggleWishlist(userId, productId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
        data: result,
    });
});

const getUserWishlist = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(status.UNAUTHORIZED, "Please log in to view your wishlist");
    }

    const result = await WishlistService.getUserWishlist(userId, req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Wishlist retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

export const WishlistController = {
    toggleWishlist,
    getUserWishlist,
};

