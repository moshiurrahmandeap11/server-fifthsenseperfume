import { z } from "zod";

const sizeChartRowSchema = z.object({
    euSize: z.string().min(1, "EU size is required"),
    ukSize: z.string().optional(),
    usSize: z.string().optional(),
    footLengthCm: z.coerce.number().optional(),
    footLengthInch: z.coerce.number().optional(),
});

const rowsPreprocessor = z.preprocess((val) => {
    if (typeof val === "string") {
        try {
            return JSON.parse(val);
        } catch {
            return val;
        }
    }
    return val;
}, z.array(sizeChartRowSchema).min(1, "At least one size row is required"));

export const createSizeChartZodSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(100, "Title must be at most 100 characters"),
    description: z.string().max(500, "Description must be at most 500 characters").optional(),
    guideImage: z.string().optional(),
    rows: rowsPreprocessor,
});

export const updateSizeChartZodSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(100, "Title must be at most 100 characters").optional(),
    description: z.string().max(500, "Description must be at most 500 characters").optional(),
    guideImage: z.string().optional(),
    rows: z.preprocess((val) => {
        if (typeof val === "string") {
            try {
                return JSON.parse(val);
            } catch {
                return val;
            }
        }
        return val;
    }, z.array(sizeChartRowSchema).min(1).optional()),
});

