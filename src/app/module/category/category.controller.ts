import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CategoryService } from "./category.service";

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.getAllCategories(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Categories retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getCategoryByIdOrSlug = catchAsync(async (req: Request, res: Response) => {
    const idOrSlug = req.params.idOrSlug as string;
    const result = await CategoryService.getCategoryByIdOrSlug(idOrSlug);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Category details retrieved successfully",
        data: result,
    });
});

const createCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.createCategory(req.body, req.file);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Category created successfully",
        data: result,
    });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await CategoryService.updateCategory(id, req.body, req.file);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Category updated successfully",
        data: result,
    });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await CategoryService.deleteCategory(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Category deleted successfully",
        data: result,
    });
});

export const CategoryController = {
    getAllCategories,
    getCategoryByIdOrSlug,
    createCategory,
    updateCategory,
    deleteCategory,
};

