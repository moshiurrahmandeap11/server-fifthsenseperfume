import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CartService } from "./cart.service";

const getUserCart = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(status.UNAUTHORIZED, "Please log in to view your cart");
    }

    const result = await CartService.getUserCart(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Cart retrieved successfully",
        data: result,
    });
});

const addItemToCart = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(status.UNAUTHORIZED, "Please log in to add items to your cart");
    }

    const result = await CartService.addItemToCart(userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shoe size added to cart successfully",
        data: result,
    });
});

const updateCartItem = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(status.UNAUTHORIZED, "Please log in to modify your cart");
    }

    const itemId = req.params.id as string;
    const result = await CartService.updateCartItem(userId, itemId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Cart item quantity updated successfully",
        data: result,
    });
});

const removeCartItem = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(status.UNAUTHORIZED, "Please log in to modify your cart");
    }

    const itemId = req.params.id as string;
    const result = await CartService.removeCartItem(userId, itemId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Item removed from cart successfully",
        data: result,
    });
});

const clearCart = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(status.UNAUTHORIZED, "Please log in to modify your cart");
    }

    const result = await CartService.clearCart(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
    });
});

const syncCart = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
        throw new AppError(status.UNAUTHORIZED, "Please log in to synchronize your cart");
    }

    const result = await CartService.syncCart(userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Guest cart synchronized successfully with your account",
        data: result,
    });
});

export const CartController = {
    getUserCart,
    addItemToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    syncCart,
};

