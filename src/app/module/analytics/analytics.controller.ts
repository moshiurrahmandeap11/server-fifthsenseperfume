import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AnalyticsService } from "./analytics.service";

const getDashboardAnalytics = catchAsync(async (_req: Request, res: Response) => {
    const result = await AnalyticsService.getDashboardAnalytics();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Executive dashboard metrics retrieved successfully",
        data: result,
    });
});

const getSizeDemandAnalytics = catchAsync(async (_req: Request, res: Response) => {
    const result = await AnalyticsService.getSizeDemandAnalytics();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Footwear size-run demand analytics retrieved successfully",
        data: result,
    });
});

const getNetProfitAnalytics = catchAsync(async (req: Request, res: Response) => {
    const result = await AnalyticsService.getNetProfitAnalytics(req.query as any);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Net profit & financial breakdown calculated successfully",
        data: result,
    });
});

const getModeratorPerformance = catchAsync(async (_req: Request, res: Response) => {
    const result = await AnalyticsService.getModeratorPerformance();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Moderator & call center performance report retrieved successfully",
        data: result,
    });
});

export const AnalyticsController = {
    getDashboardAnalytics,
    getSizeDemandAnalytics,
    getNetProfitAnalytics,
    getModeratorPerformance,
};

