import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AdminService } from "./admin.service";

const getAllStaff = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.getAllStaff(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Staff list retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getStaffById = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await AdminService.getStaffById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Staff details retrieved successfully",
        data: result,
    });
});

const createStaff = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.createStaff(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Staff member created successfully",
        data: result,
    });
});

const updateStaff = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await AdminService.updateStaff(id, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Staff member updated successfully",
        data: result,
    });
});

const deleteStaff = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const currentUserId = req.user?.userId as string;
    const result = await AdminService.deleteStaff(id, currentUserId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Staff member deactivated successfully",
        data: result,
    });
});

const getActivityLogs = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.getActivityLogs(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Activity logs retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getBlacklist = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.getBlacklist(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Blacklist retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const addToBlacklist = catchAsync(async (req: Request, res: Response) => {
    const result = await AdminService.addToBlacklist(req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Phone added to fraud blacklist successfully",
        data: result,
    });
});

const removeFromBlacklist = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await AdminService.removeFromBlacklist(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Phone removed from blacklist successfully",
        data: result,
    });
});

export const AdminController = {
    getAllStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    getActivityLogs,
    getBlacklist,
    addToBlacklist,
    removeFromBlacklist,
};
