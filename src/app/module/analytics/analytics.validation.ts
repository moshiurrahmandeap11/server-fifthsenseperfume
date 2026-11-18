import { z } from "zod";

export const dateRangeQueryZodSchema = z.object({
    query: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
    }),
});

export const AnalyticsValidation = {
    dateRangeQueryZodSchema,
};

