/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import slugify from "slugify";
import { Prisma } from "../../../generated/prisma/client";
import { FitType, ProductGender, ProductStatus, StockMovementType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { ICreateProductPayload, IUpdateProductPayload } from "./product.interface";

const getAllProducts = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.product, query, {
        searchableFields: ["name", "styleCode", "upperMaterial", "soleMaterial"],
        filterableFields: [
            "gender",
            "status",
            "fitType",
            "categoryId",
            "isFeatured",
            "isNewArrival",
            "isBestSeller",
            "isBrokenSize",
        ],
    })
        .where({
            isDeleted: false,
        });

    // Custom shoe-specific filter logic
    const whereConditions: Prisma.ProductWhereInput = {};

    // Filter by Shoe Size (e.g. EU 41, 42)
    if (query.size) {
        whereConditions.variants = {
            some: {
                size: String(query.size),
                stockQuantity: { gt: 0 },
                isActive: true,
            },
        };
    }

    // Filter by Color Name
    if (query.color) {
        whereConditions.colors = {
            some: {
                colorName: { equals: String(query.color), mode: "insensitive" },
            },
        };
    }

    // Price range filters
    if (query.minPrice || query.maxPrice) {
        whereConditions.basePrice = {
            ...(query.minPrice ? { gte: Number(query.minPrice) } : {}),
            ...(query.maxPrice ? { lte: Number(query.maxPrice) } : {}),
        };
    }

    // Filter only in-stock shoes
    if (query.inStock === "true") {
        whereConditions.variants = {
            some: {
                stockQuantity: { gt: 0 },
                isActive: true,
            },
        };
    }

    queryBuilder
        .where(whereConditions)
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            category: {
                select: { id: true, name: true, slug: true },
            },
            colors: {
                orderBy: { sortOrder: "asc" },
                include: {
                    variants: {
                        where: { isActive: true },
                        orderBy: { size: "asc" },
                    },
                },
            },
            _count: {
                select: { reviews: true },
            },
        });

    return await queryBuilder.execute();
};

const getShopBySize = async (query: Record<string, any>) => {
    const targetSize = String(query.size || "41");
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 12);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
        isDeleted: false,
        status: ProductStatus.PUBLISHED,
        ...(query.gender ? { gender: query.gender as ProductGender } : {}),
        variants: {
            some: {
                size: targetSize,
                stockQuantity: { gt: 0 },
                isActive: true,
            },
        },
    };

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                category: { select: { id: true, name: true, slug: true } },
                colors: {
                    include: {
                        variants: {
                            where: { size: targetSize, stockQuantity: { gt: 0 } },
                        },
                    },
                },
            },
        }),
        prisma.product.count({ where }),
    ]);

    return {
        data: products,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            targetSize,
        },
    };
};

const getProductByIdOrSlug = async (idOrSlug: string) => {
    const product = await prisma.product.findFirst({
        where: {
            OR: [{ id: idOrSlug }, { slug: idOrSlug }],
            isDeleted: false,
        },
        include: {
            category: true,
            sizeChart: true,
            colors: {
                orderBy: { sortOrder: "asc" },
                include: {
                    variants: {
                        where: { isActive: true },
                        orderBy: { size: "asc" },
                    },
                },
            },
            crossSells: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                include: {
                    addonProduct: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            basePrice: true,
                            discountPrice: true,
                            thumbnailUrl: true,
                        },
                    },
                },
            },
            reviews: {
                where: { isApproved: true },
                take: 5,
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { id: true, name: true, image: true } },
                },
            },
            _count: {
                select: { reviews: true, wishlists: true },
            },
        },
    });

    if (!product) {
        throw new AppError(status.NOT_FOUND, "Product not found");
    }

    return product;
};

const createProduct = async (payload: ICreateProductPayload) => {
    const generatedSlug = payload.slug || slugify(payload.name, { lower: true, strict: true });

    // Check uniqueness of styleCode and slug
    const existing = await prisma.product.findFirst({
        where: {
            OR: [{ styleCode: payload.styleCode }, { slug: generatedSlug }],
        },
    });

    if (existing) {
        throw new AppError(status.CONFLICT, "A product with this Style Code or Slug already exists");
    }

    // Default thumbnail: explicit payload or first image of first color
    const defaultThumbnail = payload.thumbnailUrl || payload.colors?.[0]?.images?.[0];
    if (!defaultThumbnail) {
        throw new AppError(status.BAD_REQUEST, "A thumbnail image or color image is required");
    }

    // Atomic transaction for Product + Colors + Variants + CrossSells
    const newProduct = await prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
            data: {
                name: payload.name,
                nameBn: payload.nameBn,
                slug: generatedSlug,
                styleCode: payload.styleCode,
                shortDescription: payload.shortDescription,
                description: payload.description,
                specifications: (payload.specifications as Prisma.InputJsonValue) || Prisma.JsonNull,
                gender: payload.gender || ProductGender.MEN,
                fitType: payload.fitType || FitType.TRUE_TO_SIZE,
                upperMaterial: payload.upperMaterial,
                soleMaterial: payload.soleMaterial,
                insoleType: payload.insoleType,
                heelHeight: payload.heelHeight,
                closureType: payload.closureType,
                warrantyDays: payload.warrantyDays || 0,
                costPrice: payload.costPrice,
                basePrice: payload.basePrice,
                discountPrice: payload.discountPrice,
                thumbnailUrl: defaultThumbnail,
                videoUrl: payload.videoUrl,
                status: payload.status || ProductStatus.DRAFT,
                isFeatured: payload.isFeatured || false,
                isNewArrival: payload.isNewArrival !== undefined ? payload.isNewArrival : true,
                isBestSeller: payload.isBestSeller || false,
                categoryId: payload.categoryId,
                sizeChartId: payload.sizeChartId || null,
            },
        });

        // Create Colors and their Variants
        for (const color of payload.colors) {
            const createdColor = await tx.productColor.create({
                data: {
                    productId: createdProduct.id,
                    colorName: color.colorName,
                    colorHex: color.colorHex,
                    images: color.images,
                    videoUrl: color.videoUrl,
                    isDefault: color.isDefault || false,
                    sortOrder: color.sortOrder || 0,
                },
            });

            for (const variant of color.variants) {
                // Generate SKU if not provided: STYLE-CLR-SIZE e.g. SHOE-BLK-41
                const colorCode = color.colorName.substring(0, 3).toUpperCase();
                const sku = variant.sku || `${payload.styleCode}-${colorCode}-${variant.size}`;

                const createdVariant = await tx.productVariant.create({
                    data: {
                        productId: createdProduct.id,
                        productColorId: createdColor.id,
                        size: variant.size,
                        ukSize: variant.ukSize,
                        usSize: variant.usSize,
                        footLengthCm: variant.footLengthCm,
                        sku,
                        barcode: variant.barcode || sku,
                        stockQuantity: variant.stockQuantity,
                        showroomStock: variant.showroomStock || 0,
                        lowStockThreshold: variant.lowStockThreshold || 3,
                        priceOverride: variant.priceOverride,
                        salePriceOverride: variant.salePriceOverride,
                        isActive: variant.isActive !== undefined ? variant.isActive : true,
                    },
                });

                // Auto-log initial factory stock movement
                if (variant.stockQuantity > 0) {
                    await tx.stockMovement.create({
                        data: {
                            variantId: createdVariant.id,
                            type: StockMovementType.FACTORY_IN,
                            quantityChange: variant.stockQuantity,
                            previousStock: 0,
                            newStock: variant.stockQuantity,
                            note: "Initial factory stock-in during product creation",
                        },
                    });
                }
            }
        }

        // Create Cross-sells if provided
        if (payload.crossSellProductIds && payload.crossSellProductIds.length > 0) {
            await tx.productCrossSell.createMany({
                data: payload.crossSellProductIds.map((addonId, index) => ({
                    mainProductId: createdProduct.id,
                    addonProductId: addonId,
                    sortOrder: index,
                })),
            });
        }

        return createdProduct;
    });

    return await getProductByIdOrSlug(newProduct.id);
};

const updateProduct = async (id: string, payload: IUpdateProductPayload) => {
    const existing = await prisma.product.findUnique({
        where: { id, isDeleted: false },
        include: { colors: { include: { variants: true } } },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Product not found");
    }

    const newSlug = payload.name && !payload.slug
        ? slugify(payload.name, { lower: true, strict: true })
        : payload.slug;

    // Check uniqueness conflicts on styleCode or slug
    if (payload.styleCode || newSlug) {
        const conflict = await prisma.product.findFirst({
            where: {
                id: { not: id },
                OR: [
                    ...(payload.styleCode ? [{ styleCode: payload.styleCode }] : []),
                    ...(newSlug ? [{ slug: newSlug }] : []),
                ],
            },
        });

        if (conflict) {
            throw new AppError(status.CONFLICT, "Another product with this Style Code or Slug already exists");
        }
    }

    await prisma.$transaction(async (tx) => {
        // 1. Update parent product fields
        await tx.product.update({
            where: { id },
            data: {
                ...(payload.name && { name: payload.name }),
                ...(payload.nameBn !== undefined && { nameBn: payload.nameBn }),
                ...(newSlug && { slug: newSlug }),
                ...(payload.styleCode && { styleCode: payload.styleCode }),
                ...(payload.shortDescription !== undefined && { shortDescription: payload.shortDescription }),
                ...(payload.description && { description: payload.description }),
                ...(payload.specifications !== undefined && {
                    specifications: (payload.specifications as Prisma.InputJsonValue) || Prisma.JsonNull,
                }),
                ...(payload.gender && { gender: payload.gender }),
                ...(payload.fitType && { fitType: payload.fitType }),
                ...(payload.upperMaterial !== undefined && { upperMaterial: payload.upperMaterial }),
                ...(payload.soleMaterial !== undefined && { soleMaterial: payload.soleMaterial }),
                ...(payload.insoleType !== undefined && { insoleType: payload.insoleType }),
                ...(payload.heelHeight !== undefined && { heelHeight: payload.heelHeight }),
                ...(payload.closureType !== undefined && { closureType: payload.closureType }),
                ...(payload.warrantyDays !== undefined && { warrantyDays: payload.warrantyDays }),
                ...(payload.costPrice !== undefined && { costPrice: payload.costPrice }),
                ...(payload.basePrice !== undefined && { basePrice: payload.basePrice }),
                ...(payload.discountPrice !== undefined && { discountPrice: payload.discountPrice }),
                ...(payload.thumbnailUrl && { thumbnailUrl: payload.thumbnailUrl }),
                ...(payload.videoUrl !== undefined && { videoUrl: payload.videoUrl }),
                ...(payload.status && { status: payload.status }),
                ...(payload.isFeatured !== undefined && { isFeatured: payload.isFeatured }),
                ...(payload.isNewArrival !== undefined && { isNewArrival: payload.isNewArrival }),
                ...(payload.isBestSeller !== undefined && { isBestSeller: payload.isBestSeller }),
                ...(payload.isBrokenSize !== undefined && { isBrokenSize: payload.isBrokenSize }),
                ...(payload.categoryId && { categoryId: payload.categoryId }),
                ...(payload.sizeChartId !== undefined && { sizeChartId: payload.sizeChartId }),
            },
        });

        // 2. If colors are updated, sync nested colors and variants
        if (payload.colors && payload.colors.length > 0) {
            for (const color of payload.colors) {
                let colorId = color.id;

                if (colorId) {
                    // Update existing color
                    await tx.productColor.update({
                        where: { id: colorId },
                        data: {
                            colorName: color.colorName,
                            colorHex: color.colorHex,
                            images: color.images,
                            videoUrl: color.videoUrl,
                            isDefault: color.isDefault || false,
                            sortOrder: color.sortOrder || 0,
                        },
                    });
                } else {
                    // Create new color
                    const createdColor = await tx.productColor.create({
                        data: {
                            productId: id,
                            colorName: color.colorName,
                            colorHex: color.colorHex,
                            images: color.images,
                            videoUrl: color.videoUrl,
                            isDefault: color.isDefault || false,
                            sortOrder: color.sortOrder || 0,
                        },
                    });
                    colorId = createdColor.id;
                }

                // Upsert variants under this color
                for (const variant of color.variants) {
                    const styleCode = payload.styleCode || existing.styleCode;
                    const colorCode = color.colorName.substring(0, 3).toUpperCase();
                    const sku = variant.sku || `${styleCode}-${colorCode}-${variant.size}`;

                    if (variant.id) {
                        await tx.productVariant.update({
                            where: { id: variant.id },
                            data: {
                                size: variant.size,
                                ukSize: variant.ukSize,
                                usSize: variant.usSize,
                                footLengthCm: variant.footLengthCm,
                                sku,
                                barcode: variant.barcode || sku,
                                stockQuantity: variant.stockQuantity,
                                showroomStock: variant.showroomStock,
                                lowStockThreshold: variant.lowStockThreshold,
                                priceOverride: variant.priceOverride,
                                salePriceOverride: variant.salePriceOverride,
                                isActive: variant.isActive !== undefined ? variant.isActive : true,
                            },
                        });
                    } else {
                        await tx.productVariant.create({
                            data: {
                                productId: id,
                                productColorId: colorId,
                                size: variant.size,
                                ukSize: variant.ukSize,
                                usSize: variant.usSize,
                                footLengthCm: variant.footLengthCm,
                                sku,
                                barcode: variant.barcode || sku,
                                stockQuantity: variant.stockQuantity,
                                showroomStock: variant.showroomStock || 0,
                                lowStockThreshold: variant.lowStockThreshold || 3,
                                priceOverride: variant.priceOverride,
                                salePriceOverride: variant.salePriceOverride,
                                isActive: variant.isActive !== undefined ? variant.isActive : true,
                            },
                        });
                    }
                }
            }
        }

        // 3. Sync Cross-Sells if provided
        if (payload.crossSellProductIds !== undefined) {
            await tx.productCrossSell.deleteMany({
                where: { mainProductId: id },
            });

            if (payload.crossSellProductIds.length > 0) {
                await tx.productCrossSell.createMany({
                    data: payload.crossSellProductIds.map((addonId, index) => ({
                        mainProductId: id,
                        addonProductId: addonId,
                        sortOrder: index,
                    })),
                });
            }
        }
    });

    return await getProductByIdOrSlug(id);
};

const deleteProduct = async (id: string) => {
    const product = await prisma.product.findUnique({
        where: { id, isDeleted: false },
    });

    if (!product) {
        throw new AppError(status.NOT_FOUND, "Product not found");
    }

    // Soft delete to preserve historical order records and review linkages
    await prisma.product.update({
        where: { id },
        data: {
            isDeleted: true,
            status: ProductStatus.ARCHIVED,
            deletedAt: new Date(),
        },
    });

    return { message: "Product archived successfully" };
};

export const ProductService = {
    getAllProducts,
    getShopBySize,
    getProductByIdOrSlug,
    createProduct,
    updateProduct,
    deleteProduct,
};
