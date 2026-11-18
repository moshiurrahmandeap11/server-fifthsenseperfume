import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { UserService } from "./user.service";

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;
    const result = await UserService.getMyProfile(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile retrieved successfully",
        data: result,
    });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;
    const result = await UserService.updateMyProfile(userId, req.body, req.file);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile updated successfully",
        data: result,
    });
});

const getMyAddresses = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;
    const result = await UserService.getMyAddresses(userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Addresses retrieved successfully",
        data: result,
    });
});

const createAddress = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;
    const result = await UserService.createAddress(userId, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Address added successfully",
        data: result,
    });
});

const updateAddress = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;
    const id = req.params.id as string;
    const result = await UserService.updateAddress(userId, id, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Address updated successfully",
        data: result,
    });
});

const deleteAddress = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string;
    const id = req.params.id as string;
    const result = await UserService.deleteAddress(userId, id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Address deleted successfully",
        data: result,
    });
});

const getAllCustomers = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.getAllCustomers(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Customers retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getCustomerById = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await UserService.getCustomerById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Customer details retrieved successfully",
        data: result,
    });
});

export const UserController = {
    getMyProfile,
    updateMyProfile,
    getMyAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    getAllCustomers,
    getCustomerById,
};
