/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { ICreateSizeChartPayload, IUpdateSizeChartPayload } from "./sizeChart.interface";

const getAllSizeCharts = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.sizeChart, query, {
        searchableFields: ["title", "description"],
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            _count: {
                select: { products: true },
            },
        });

    return await queryBuilder.execute();
};

const getSizeChartById = async (id: string) => {
    const sizeChart = await prisma.sizeChart.findUnique({
        where: { id },
        include: {
            _count: {
                select: { products: true },
            },
        },
    });

    if (!sizeChart) {
        throw new AppError(status.NOT_FOUND, "Size chart not found");
    }

    return sizeChart;
};

const createSizeChart = async (
    payload: ICreateSizeChartPayload,
    file?: Express.Multer.File
) => {
    const existing = await prisma.sizeChart.findUnique({
        where: { title: payload.title },
    });

    if (existing) {
        throw new AppError(status.CONFLICT, "A size chart with this title already exists");
    }

    const guideImageUrl = file?.path || payload.guideImage;

    const newSizeChart = await prisma.sizeChart.create({
        data: {
            title: payload.title,
            description: payload.description,
            guideImage: guideImageUrl,
            rows: payload.rows as unknown as Prisma.InputJsonValue,
        },
    });

    return newSizeChart;
};

const updateSizeChart = async (
    id: string,
    payload: IUpdateSizeChartPayload,
    file?: Express.Multer.File
) => {
    const existing = await prisma.sizeChart.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Size chart not found");
    }

    if (payload.title && payload.title !== existing.title) {
        const titleConflict = await prisma.sizeChart.findUnique({
            where: { title: payload.title },
        });

        if (titleConflict) {
            throw new AppError(status.CONFLICT, "Another size chart with this title already exists");
        }
    }

    const guideImageUrl = file?.path || payload.guideImage;

    const updated = await prisma.sizeChart.update({
        where: { id },
        data: {
            ...(payload.title && { title: payload.title }),
            ...(payload.description !== undefined && { description: payload.description }),
            ...(guideImageUrl && { guideImage: guideImageUrl }),
            ...(payload.rows && { rows: payload.rows as unknown as Prisma.InputJsonValue }),
        },
    });

    return updated;
};

const deleteSizeChart = async (id: string) => {
    const sizeChart = await prisma.sizeChart.findUnique({
        where: { id },
        include: {
            _count: {
                select: { products: true },
            },
        },
    });

    if (!sizeChart) {
        throw new AppError(status.NOT_FOUND, "Size chart not found");
    }

    if (sizeChart._count.products > 0) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot delete size chart. It is linked to ${sizeChart._count.products} products.`
        );
    }

    await prisma.sizeChart.delete({
        where: { id },
    });

    return { message: "Size chart deleted successfully" };
};

export const SizeChartService = {
    getAllSizeCharts,
    getSizeChartById,
    createSizeChart,
    updateSizeChart,
    deleteSizeChart,
};

