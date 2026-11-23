import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { MediaService } from "./media.service";

const uploadSingleImage = catchAsync(async (req: Request, res: Response) => {
    const result = await MediaService.handleSingleUpload(req.file);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Image uploaded successfully",
        data: result,
    });
});

const uploadMultipleImages = catchAsync(async (req: Request, res: Response) => {
    const files = Array.isArray(req.files) ? req.files : [];
    const result = await MediaService.handleMultipleUpload(files);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `${result.files.length} image(s) uploaded successfully`,
        data: result,
    });
});

const deleteImage = catchAsync(async (req: Request, res: Response) => {
    const { url } = req.body as { url: string };
    const result = await MediaService.deleteMediaByUrl(url);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Image deleted from cloud storage",
        data: result,
    });
});

export const MediaController = {
    uploadSingleImage,
    uploadMultipleImages,
    deleteImage,
};
