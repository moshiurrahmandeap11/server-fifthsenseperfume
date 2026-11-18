import { z } from "zod";

const parseOptionalString = z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.string().optional()
);

const parseParentId = z.preprocess(
    (val) => (val === "" || val === "null" || val === "undefined" || val === "none" || val === null || val === undefined ? null : val),
    z.string().uuid("Invalid parent category ID").nullable().optional()
);

const parseBoolean = z.preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
}, z.boolean().optional());

export const createCategoryZodSchema = z.object({
    name: z.string().min(2, "Category name must be at least 2 characters").max(60, "Category name must be at most 60 characters"),
    nameBn: parseOptionalString,
    slug: parseOptionalString,
    description: z.preprocess(
        (val) => (val === "" || val === null || val === undefined ? undefined : val),
        z.string().max(500, "Description must be at most 500 characters").optional()
    ),
    icon: parseOptionalString,
    image: parseOptionalString,
    sortOrder: z.coerce.number().int().optional(),
    isActive: parseBoolean,
    parentId: parseParentId,
});

export const updateCategoryZodSchema = z.object({
    name: z.string().min(2, "Category name must be at least 2 characters").max(60, "Category name must be at most 60 characters").optional(),
    nameBn: parseOptionalString,
    slug: parseOptionalString,
    description: z.preprocess(
        (val) => (val === "" || val === null || val === undefined ? undefined : val),
        z.string().max(500, "Description must be at most 500 characters").optional()
    ),
    icon: parseOptionalString,
    image: parseOptionalString,
    sortOrder: z.coerce.number().int().optional(),
    isActive: parseBoolean,
    parentId: parseParentId,
});

