/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { StockMovementType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { IFactoryStockInPayload, IQuickStockUpdatePayload } from "./inventory.interface";

const getSizeMatrix = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.product, query, {
        searchableFields: ["name", "styleCode"],
        filterableFields: ["categoryId", "status", "gender"],
    })
        .where({
            isDeleted: false,
        })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            category: { select: { id: true, name: true } },
            colors: {
                orderBy: { sortOrder: "asc" },
                include: {
                    variants: {
                        where: { isActive: true },
                        orderBy: { size: "asc" },
                        select: {
                            id: true,
                            size: true,
                            sku: true,
                            barcode: true,
                            stockQuantity: true,
                            showroomStock: true,
                            lowStockThreshold: true,
                            priceOverride: true,
                            salePriceOverride: true,
                        },
                    },
                },
            },
        });

    return await queryBuilder.execute();
};

const quickStockUpdate = async (payload: IQuickStockUpdatePayload, actorId?: string) => {
    const variant = await prisma.productVariant.findUnique({
        where: { id: payload.variantId },
        include: { product: true },
    });

    if (!variant) {
        throw new AppError(status.NOT_FOUND, "Product variant not found");
    }

    const previousStock = variant.stockQuantity;
    const newStock = payload.newStockQuantity;
    const quantityChange = newStock - previousStock;

    const updatedVariant = await prisma.$transaction(async (tx) => {
        // Update variant stock
        const updated = await tx.productVariant.update({
            where: { id: payload.variantId },
            data: {
                stockQuantity: newStock,
                ...(payload.showroomStock !== undefined && { showroomStock: payload.showroomStock }),
            },
            include: {
                product: { select: { id: true, name: true, styleCode: true } },
                productColor: { select: { colorName: true } },
            },
        });

        // Log StockMovement if stock changed
        if (quantityChange !== 0) {
            await tx.stockMovement.create({
                data: {
                    variantId: payload.variantId,
                    type: payload.type || StockMovementType.MANUAL_ADJUSTMENT,
                    quantityChange,
                    previousStock,
                    newStock,
                    note: payload.note || "Quick stock adjustment from inventory grid",
                    actorId: actorId || null,
                },
            });
        }

        // Check broken size condition: if core sizes (40, 41, 42) are out of stock, flag product
        const allVariants = await tx.productVariant.findMany({
            where: { productId: variant.productId, isActive: true },
        });

        const coreSizes = ["40", "41", "42"];
        const coreVariants = allVariants.filter((v) => coreSizes.includes(v.size));
        const edgeVariants = allVariants.filter((v) => !coreSizes.includes(v.size));

        const isCoreOutOfStock = coreVariants.length > 0 && coreVariants.every((v) => v.stockQuantity === 0);
        const hasEdgeStock = edgeVariants.some((v) => v.stockQuantity > 0);
        const isBrokenSize = isCoreOutOfStock && hasEdgeStock;

        if (variant.product.isBrokenSize !== isBrokenSize) {
            await tx.product.update({
                where: { id: variant.productId },
                data: { isBrokenSize },
            });
        }

        return updated;
    });

    return updatedVariant;
};

const getLowStockAlerts = async (query: Record<string, any>) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 15);
    const skip = (page - 1) * limit;

    const customThreshold = query.threshold ? Number(query.threshold) : undefined;

    const where: Prisma.ProductVariantWhereInput = {
        isActive: true,
        product: { isDeleted: false },
        ...(customThreshold !== undefined
            ? { stockQuantity: { lte: customThreshold } }
            : { stockQuantity: { lte: 3 } }),
    };

    const [variants, total] = await Promise.all([
        prisma.productVariant.findMany({
            where,
            skip,
            take: limit,
            orderBy: { stockQuantity: "asc" },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        styleCode: true,
                        basePrice: true,
                        isBrokenSize: true,
                    },
                },
                productColor: {
                    select: {
                        id: true,
                        colorName: true,
                        images: true,
                    },
                },
            },
        }),
        prisma.productVariant.count({ where }),
    ]);

    return {
        data: variants,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

const getStockMovements = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.stockMovement, query, {
        searchableFields: ["note", "referenceId"],
        filterableFields: ["type", "variantId", "actorId"],
    });

    // Date range filter support
    if (query.startDate || query.endDate) {
        queryBuilder.where({
            createdAt: {
                ...(query.startDate && { gte: new Date(String(query.startDate)) }),
                ...(query.endDate && { lte: new Date(String(query.endDate)) }),
            },
        });
    }

    queryBuilder
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            variant: {
                include: {
                    product: { select: { id: true, name: true, styleCode: true } },
                    productColor: { select: { colorName: true } },
                },
            },
            actor: {
                select: { id: true, name: true, email: true, role: true },
            },
        });

    return await queryBuilder.execute();
};

const factoryStockIn = async (payload: IFactoryStockInPayload, actorId?: string) => {
    const updatedVariants = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const item of payload.items) {
            const variant = await tx.productVariant.findUnique({
                where: { id: item.variantId },
            });

            if (!variant) {
                throw new AppError(status.NOT_FOUND, `Variant with ID ${item.variantId} not found`);
            }

            const previousStock = variant.stockQuantity;
            const newStock = previousStock + item.quantity;

            // Increment variant stock
            const updated = await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stockQuantity: newStock },
                include: {
                    product: { select: { name: true, styleCode: true } },
                    productColor: { select: { colorName: true } },
                },
            });

            // Log StockMovement
            await tx.stockMovement.create({
                data: {
                    variantId: item.variantId,
                    type: StockMovementType.FACTORY_IN,
                    quantityChange: item.quantity,
                    previousStock,
                    newStock,
                    referenceId: payload.shipmentReference || null,
                    note: payload.note || "Factory batch stock received",
                    actorId: actorId || null,
                },
            });

            results.push(updated);
        }

        return results;
    });

    const totalQuantityReceived = payload.items.reduce((acc, curr) => acc + curr.quantity, 0);

    return {
        totalItemsCount: payload.items.length,
        totalQuantityReceived,
        shipmentReference: payload.shipmentReference,
        variants: updatedVariants,
    };
};

const getBarcodeLabel = async (variantId: string) => {
    const variant = await prisma.productVariant.findFirst({
        where: {
            OR: [{ id: variantId }, { sku: variantId }, { barcode: variantId }],
        },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    nameBn: true,
                    styleCode: true,
                    basePrice: true,
                    discountPrice: true,
                    upperMaterial: true,
                    soleMaterial: true,
                },
            },
            productColor: {
                select: {
                    colorName: true,
                },
            },
        },
    });

    if (!variant) {
        throw new AppError(status.NOT_FOUND, "Product variant not found for label printing");
    }

    // Standardized shoe box thermal sticker format (e.g. 50mm x 30mm or 4" x 2")
    return {
        productName: variant.product.name,
        nameBn: variant.product.nameBn,
        styleCode: variant.product.styleCode,
        color: variant.productColor.colorName,
        size: variant.size,
        ukSize: variant.ukSize,
        usSize: variant.usSize,
        footLengthCm: variant.footLengthCm,
        sku: variant.sku,
        barcode: variant.barcode || variant.sku,
        mrp: variant.priceOverride || variant.product.basePrice,
        salePrice: variant.salePriceOverride || variant.product.discountPrice,
        upperMaterial: variant.product.upperMaterial,
        soleMaterial: variant.product.soleMaterial,
        currency: "BDT",
        brand: "EcomBD Footwear",
        origin: "Made in Bangladesh",
    };
};

export const InventoryService = {
    getSizeMatrix,
    quickStockUpdate,
    getLowStockAlerts,
    getStockMovements,
    factoryStockIn,
    getBarcodeLabel,
};

