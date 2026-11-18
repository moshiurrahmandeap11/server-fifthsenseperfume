import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { InventoryService } from "./inventory.service";

const getSizeMatrix = catchAsync(async (req: Request, res: Response) => {
    const result = await InventoryService.getSizeMatrix(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Inventory size matrix retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const quickStockUpdate = catchAsync(async (req: Request, res: Response) => {
    const actorId = req.user?.userId;
    const result = await InventoryService.quickStockUpdate(req.body, actorId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Stock adjusted and movement logged successfully",
        data: result,
    });
});

const getLowStockAlerts = catchAsync(async (req: Request, res: Response) => {
    const result = await InventoryService.getLowStockAlerts(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Low stock alerts retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getStockMovements = catchAsync(async (req: Request, res: Response) => {
    const result = await InventoryService.getStockMovements(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Stock movement history retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const factoryStockIn = catchAsync(async (req: Request, res: Response) => {
    const actorId = req.user?.userId;
    const result = await InventoryService.factoryStockIn(req.body, actorId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Factory shipment stock added successfully",
        data: result,
    });
});

const getBarcodeLabel = catchAsync(async (req: Request, res: Response) => {
    const variantId = req.params.variantId as string;
    const result = await InventoryService.getBarcodeLabel(variantId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shoe box barcode label data generated successfully",
        data: result,
    });
});

export const InventoryController = {
    getSizeMatrix,
    quickStockUpdate,
    getLowStockAlerts,
    getStockMovements,
    factoryStockIn,
    getBarcodeLabel,
};

