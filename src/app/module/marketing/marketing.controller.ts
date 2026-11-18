import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { MarketingService } from "./marketing.service";

// --- Coupons ---
const applyCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await MarketingService.applyCoupon(req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message || "Coupon applied successfully",
        data: result,
    });
});

const getAllCoupons = catchAsync(async (req: Request, res: Response) => {
    const result = await MarketingService.getAllCoupons(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Coupons retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getCouponById = catchAsync(async (req: Request, res: Response) => {
    const idOrCode = req.params.id as string;
    const result = await MarketingService.getCouponById(idOrCode);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Coupon retrieved successfully",
        data: result,
    });
});

const createCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await MarketingService.createCoupon(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Coupon created successfully",
        data: result,
    });
});

const updateCoupon = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await MarketingService.updateCoupon(id, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Coupon updated successfully",
        data: result,
    });
});

const deleteCoupon = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await MarketingService.deleteCoupon(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
    });
});

// --- Flash Sales ---
const getActiveFlashSale = catchAsync(async (_req: Request, res: Response) => {
    const result = await MarketingService.getActiveFlashSale();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result ? "Active flash sale retrieved successfully" : "No active flash sale running",
        data: result,
    });
});

const getAllFlashSales = catchAsync(async (req: Request, res: Response) => {
    const result = await MarketingService.getAllFlashSales(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Flash sale campaigns retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getFlashSaleByIdOrSlug = catchAsync(async (req: Request, res: Response) => {
    const idOrSlug = req.params.idOrSlug as string;
    const result = await MarketingService.getFlashSaleByIdOrSlug(idOrSlug);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Flash sale campaign details retrieved successfully",
        data: result,
    });
});

const createFlashSale = catchAsync(async (req: Request, res: Response) => {
    const result = await MarketingService.createFlashSale(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Flash sale campaign created successfully",
        data: result,
    });
});

const updateFlashSale = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await MarketingService.updateFlashSale(id, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Flash sale campaign updated successfully",
        data: result,
    });
});

const deleteFlashSale = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await MarketingService.deleteFlashSale(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
    });
});

// --- Campaign Landing Pages ---
const getLandingPageBySlug = catchAsync(async (req: Request, res: Response) => {
    const slug = req.params.slug as string;
    const result = await MarketingService.getLandingPageBySlug(slug);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Campaign landing page retrieved successfully",
        data: result,
    });
});

const getAllLandingPages = catchAsync(async (req: Request, res: Response) => {
    const result = await MarketingService.getAllLandingPages(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Campaign landing pages retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const createLandingPage = catchAsync(async (req: Request, res: Response) => {
    const result = await MarketingService.createLandingPage(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Campaign landing page created successfully",
        data: result,
    });
});

const updateLandingPage = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await MarketingService.updateLandingPage(id, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Campaign landing page updated successfully",
        data: result,
    });
});

const deleteLandingPage = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await MarketingService.deleteLandingPage(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
    });
});

// --- Meta CAPI Test ---
const testCapiEvent = catchAsync(async (req: Request, res: Response) => {
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
    const clientUserAgent = req.headers["user-agent"];
    const result = await MarketingService.testCapiEvent(req.body, clientIp, clientUserAgent);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Meta Conversions API (CAPI) test event executed",
        data: result,
    });
});

export const MarketingController = {
    applyCoupon,
    getAllCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    getActiveFlashSale,
    getAllFlashSales,
    getFlashSaleByIdOrSlug,
    createFlashSale,
    updateFlashSale,
    deleteFlashSale,
    getLandingPageBySlug,
    getAllLandingPages,
    createLandingPage,
    updateLandingPage,
    deleteLandingPage,
    testCapiEvent,
};

