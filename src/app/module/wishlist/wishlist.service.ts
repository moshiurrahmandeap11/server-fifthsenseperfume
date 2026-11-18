/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { IToggleWishlistResult } from "./wishlist.interface";

/**
 * Toggle shoe product in customer wishlist (Add if absent, Remove if present)
 */
const toggleWishlist = async (userId: string, productId: string): Promise<IToggleWishlistResult> => {
    // 1. Verify product exists
    const product = await prisma.product.findUnique({
        where: { id: productId },
    });

    if (!product) {
        throw new AppError(status.NOT_FOUND, "Product not found");
    }

    // 2. Check if already in wishlist
    const existing = await prisma.wishlist.findUnique({
        where: {
            userId_productId: {
                userId,
                productId,
            },
        },
    });

    if (existing) {
        // Remove from wishlist
        await prisma.wishlist.delete({
            where: { id: existing.id },
        });

        return {
            inWishlist: false,
            productId,
            message: `Removed '${product.name}' from your wishlist`,
        };
    }

    // Add to wishlist
    await prisma.wishlist.create({
        data: {
            userId,
            productId,
        },
    });

    return {
        inWishlist: true,
        productId,
        message: `Added '${product.name}' to your wishlist`,
    };
};

/**
 * Get customer's saved wishlist products with colors and size variants
 */
const getUserWishlist = async (userId: string, query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.wishlist, query, {
        searchableFields: [],
        filterableFields: [],
    })
        .sort()
        .paginate();

    queryBuilder.where({
        userId,
    });

    queryBuilder.include({
        product: {
            select: {
                id: true,
                name: true,
                slug: true,
                styleCode: true,
                basePrice: true,
                thumbnailUrl: true,
                gender: true,
                fitType: true,
                status: true,
                colors: {
                    select: {
                        id: true,
                        colorName: true,
                        colorHex: true,
                        images: true,
                        variants: {
                            select: {
                                id: true,
                                size: true,
                                stockQuantity: true,
                                sku: true,
                            },
                        },
                    },
                },
            },
        },
    });

    const result = await queryBuilder.execute();
    return result;
};

export const WishlistService = {
    toggleWishlist,
    getUserWishlist,
};

