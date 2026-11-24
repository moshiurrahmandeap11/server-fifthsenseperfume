import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { SystemService } from "./system.service";

// --- Settings ---
const getPlatformSettings = catchAsync(async (_req: Request, res: Response) => {
    const result = await SystemService.getPlatformSettings();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Platform settings retrieved successfully",
        data: result,
    });
});

const updatePlatformSettings = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId;

    const payload = { ...req.body };
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    if (files) {
        if (files.logoUrl && files.logoUrl[0]) {
            payload.logoUrl = files.logoUrl[0].path;
        }
        if (files.faviconUrl && files.faviconUrl[0]) {
            payload.faviconUrl = files.faviconUrl[0].path;
        }
    }

    const result = await SystemService.updatePlatformSettings(payload, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Platform settings updated successfully",
        data: result,
    });
});

// --- Banners ---
const getAllBanners = catchAsync(async (req: Request, res: Response) => {
    const result = await SystemService.getAllBanners(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Banners retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getBannerById = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await SystemService.getBannerById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Banner details retrieved successfully",
        data: result,
    });
});

const createBanner = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId;
    const payload = { ...req.body };

    if (req.file) {
        payload.imageUrl = req.file.path;
    }

    const result = await SystemService.createBanner(payload, staffId);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Banner created successfully",
        data: result,
    });
});

const updateBanner = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const payload = { ...req.body };

    if (req.file) {
        payload.imageUrl = req.file.path;
    }

    const result = await SystemService.updateBanner(id, payload, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Banner updated successfully",
        data: result,
    });
});

const deleteBanner = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const result = await SystemService.deleteBanner(id, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
    });
});

// --- Showrooms ---
const getAllShowrooms = catchAsync(async (req: Request, res: Response) => {
    const result = await SystemService.getAllShowrooms(req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Showroom locations retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getShowroomById = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await SystemService.getShowroomById(id);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Showroom outlet details retrieved successfully",
        data: result,
    });
});

const createShowroom = catchAsync(async (req: Request, res: Response) => {
    const staffId = req.user?.userId;
    const result = await SystemService.createShowroom(req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Showroom outlet created successfully",
        data: result,
    });
});

const updateShowroom = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const result = await SystemService.updateShowroom(id, req.body, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Showroom outlet updated successfully",
        data: result,
    });
});

const deleteShowroom = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const staffId = req.user?.userId;
    const result = await SystemService.deleteShowroom(id, staffId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.message,
    });
});

// --- Locations ---
const getLocations = catchAsync(async (req: Request, res: Response) => {
    const division = req.query.division ? String(req.query.division) : undefined;
    const district = req.query.district ? String(req.query.district) : undefined;
    const result = SystemService.getLocations({ division, district });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Locations retrieved successfully",
        data: result,
    });
});

const getShippingQuote = catchAsync(async (req: Request, res: Response) => {
    const division = req.query.division ? String(req.query.division) : undefined;
    const district = req.query.district ? String(req.query.district) : undefined;
    const thana = req.query.thana ? String(req.query.thana) : undefined;
    const subtotal = req.query.subtotal ? Number(req.query.subtotal) : 0;

    const result = await SystemService.getShippingQuote({
        division,
        district,
        thana,
        subtotal,
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Shipping quote calculated successfully",
        data: result,
    });
});

export const SystemController = {
    getPlatformSettings,
    updatePlatformSettings,
    getAllBanners,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner,
    getAllShowrooms,
    getShowroomById,
    createShowroom,
    updateShowroom,
    deleteShowroom,
};

