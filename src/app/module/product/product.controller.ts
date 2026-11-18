import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ProductService } from "./product.service";

const getAllProducts = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductService.getAllProducts(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Products retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getShopBySize = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductService.getShopBySize(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Shoes available for size ${req.query.size || "41"} retrieved successfully`,
        meta: result.meta,
        data: result.data,
    });
});

const getProductByIdOrSlug = catchAsync(async (req: Request, res: Response) => {
    const idOrSlug = req.params.idOrSlug as string;
    const result = await ProductService.getProductByIdOrSlug(idOrSlug);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Product details retrieved successfully",
        data: result,
    });
});

const createProduct = catchAsync(async (req: Request, res: Response) => {
    const result = await ProductService.createProduct(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Product, colors, and size variants created successfully",
        data: result,
    });
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await ProductService.updateProduct(id, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Product updated successfully",
        data: result,
    });
});

const deleteProduct = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await ProductService.deleteProduct(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Product archived successfully",
        data: result,
    });
});

export const ProductController = {
    getAllProducts,
    getShopBySize,
    getProductByIdOrSlug,
    createProduct,
    updateProduct,
    deleteProduct,
};

