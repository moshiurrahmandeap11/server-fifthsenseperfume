import status from "http-status";
import { deleteFileFromCloudinary } from "../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";

export interface IUploadedMediaItem {
    url: string;
    publicId: string;
    originalName: string;
    mimeType: string;
    size: number;
}

const formatUploadedFile = (file: Express.Multer.File): IUploadedMediaItem => ({
    url: file.path,
    publicId: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
});

const handleSingleUpload = async (file?: Express.Multer.File): Promise<IUploadedMediaItem> => {
    if (!file || !file.path) {
        throw new AppError(status.BAD_REQUEST, "No image file provided for upload");
    }

    return formatUploadedFile(file);
};

const handleMultipleUpload = async (files?: Express.Multer.File[]) => {
    if (!files || files.length === 0) {
        throw new AppError(status.BAD_REQUEST, "No image files provided for upload");
    }

    const uploaded = files.map(formatUploadedFile);
    return {
        urls: uploaded.map((item) => item.url),
        files: uploaded,
    };
};

const deleteMediaByUrl = async (url: string) => {
    if (!url || typeof url !== "string") {
        throw new AppError(status.BAD_REQUEST, "Valid media URL is required");
    }

    await deleteFileFromCloudinary(url);
    return { deleted: true, url };
};

export const MediaService = {
    handleSingleUpload,
    handleMultipleUpload,
    deleteMediaByUrl,
};
