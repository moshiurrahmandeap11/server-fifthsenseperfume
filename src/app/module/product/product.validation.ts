import { z } from "zod";

const ProductGenders = ["MEN", "WOMEN", "KIDS", "UNISEX"] as const;
const FitTypes = ["TRUE_TO_SIZE", "RUNS_SMALL", "RUNS_LARGE", "WIDE_FIT"] as const;
const ProductStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const variantInputSchema = z.object({
    id: z.string().uuid().optional(),
    size: z.string().min(1, "Size is required"),
    ukSize: z.string().optional(),
    usSize: z.string().optional(),
    footLengthCm: z.coerce.number().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    stockQuantity: z.coerce.number().int().min(0, "Stock cannot be negative"),
    showroomStock: z.coerce.number().int().min(0).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).optional(),
    priceOverride: z.coerce.number().min(0).optional(),
    salePriceOverride: z.coerce.number().min(0).optional(),
    isActive: z.coerce.boolean().optional(),
});

const colorInputSchema = z.object({
    id: z.string().uuid().optional(),
    colorName: z.string().min(2, "Color name is required"),
    colorHex: z.string().optional(),
    images: z.array(z.string().url("Invalid image URL")).min(1, "At least one image per color is required"),
    videoUrl: z.string().url().optional(),
    isDefault: z.coerce.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
    variants: z.array(variantInputSchema).min(1, "At least one size variant is required per color"),
});

export const createProductZodSchema = z.object({
    name: z.string().min(3, "Product name must be at least 3 characters").max(100, "Product name must be at most 100 characters"),
    nameBn: z.string().optional(),
    slug: z.string().optional(),
    styleCode: z.string().min(2, "Style code is required e.g. SHOE-101"),
    shortDescription: z.string().max(300).optional(),
    description: z.string().min(10, "Description must be at least 10 characters"),
    specifications: z.record(z.string(), z.unknown()).optional(),

    gender: z.enum(ProductGenders).optional(),
    fitType: z.enum(FitTypes).optional(),
    upperMaterial: z.string().optional(),
    soleMaterial: z.string().optional(),
    insoleType: z.string().optional(),
    heelHeight: z.string().optional(),
    closureType: z.string().optional(),
    warrantyDays: z.coerce.number().int().min(0).optional(),

    costPrice: z.coerce.number().min(0, "Cost price must be positive"),
    basePrice: z.coerce.number().min(0, "Base price must be positive"),
    discountPrice: z.coerce.number().min(0).optional(),

    thumbnailUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),

    status: z.enum(ProductStatuses).optional(),
    isFeatured: z.coerce.boolean().optional(),
    isNewArrival: z.coerce.boolean().optional(),
    isBestSeller: z.coerce.boolean().optional(),

    categoryId: z.string().uuid("Invalid category ID"),
    sizeChartId: z.string().uuid("Invalid size chart ID").optional(),

    crossSellProductIds: z.array(z.string().uuid()).optional(),
    colors: z.array(colorInputSchema).min(1, "At least one color is required"),
});

export const updateProductZodSchema = z.object({
    name: z.string().min(3).max(100).optional(),
    nameBn: z.string().optional(),
    slug: z.string().optional(),
    styleCode: z.string().min(2).optional(),
    shortDescription: z.string().max(300).optional(),
    description: z.string().min(10).optional(),
    specifications: z.record(z.string(), z.unknown()).optional(),

    gender: z.enum(ProductGenders).optional(),
    fitType: z.enum(FitTypes).optional(),
    upperMaterial: z.string().optional(),
    soleMaterial: z.string().optional(),
    insoleType: z.string().optional(),
    heelHeight: z.string().optional(),
    closureType: z.string().optional(),
    warrantyDays: z.coerce.number().int().min(0).optional(),

    costPrice: z.coerce.number().min(0).optional(),
    basePrice: z.coerce.number().min(0).optional(),
    discountPrice: z.coerce.number().min(0).optional(),

    thumbnailUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),

    status: z.enum(ProductStatuses).optional(),
    isFeatured: z.coerce.boolean().optional(),
    isNewArrival: z.coerce.boolean().optional(),
    isBestSeller: z.coerce.boolean().optional(),
    isBrokenSize: z.coerce.boolean().optional(),

    categoryId: z.string().uuid().optional(),
    sizeChartId: z.string().uuid().nullable().optional(),

    crossSellProductIds: z.array(z.string().uuid()).optional(),
    colors: z.array(colorInputSchema).optional(),
});

