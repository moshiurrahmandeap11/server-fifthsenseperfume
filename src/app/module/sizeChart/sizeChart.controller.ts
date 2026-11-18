import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SizeChartService } from "./sizeChart.service";

const getAllSizeCharts = catchAsync(async (req: Request, res: Response) => {
    const result = await SizeChartService.getAllSizeCharts(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Size charts retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getSizeChartById = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await SizeChartService.getSizeChartById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Size chart retrieved successfully",
        data: result,
    });
});

const createSizeChart = catchAsync(async (req: Request, res: Response) => {
    const result = await SizeChartService.createSizeChart(req.body, req.file);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Size chart created successfully",
        data: result,
    });
});

const updateSizeChart = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await SizeChartService.updateSizeChart(id, req.body, req.file);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Size chart updated successfully",
        data: result,
    });
});

const deleteSizeChart = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await SizeChartService.deleteSizeChart(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Size chart deleted successfully",
        data: result,
    });
});

export const SizeChartController = {
    getAllSizeCharts,
    getSizeChartById,
    createSizeChart,
    updateSizeChart,
    deleteSizeChart,
};

