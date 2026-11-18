/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
    IAddToCartPayload,
    ICartItemDetails,
    ICartResponse,
    ISyncCartPayload,
    IUpdateCartItemPayload,
} from "./cart.interface";

/**
 * Format raw database cart model into client-ready response with live stock checks
 */
const formatCartResponse = (cart: any): ICartResponse => {
    let subtotal = 0;
    let totalQuantity = 0;
    let hasOutOfStockItems = false;

    const items: ICartItemDetails[] = (cart.items || []).map((item: any) => {
        const variant = item.variant;
        const product = variant.product;
        const color = variant.productColor;

        const unitPrice =
            variant.salePriceOverride ?? product.salePrice ?? variant.priceOverride ?? product.basePrice;
        const originalPrice = product.basePrice;
        const stockAvailable = variant.stockQuantity || 0;
        const isOutOfStock = stockAvailable <= 0;
        const isAvailable = stockAvailable >= item.quantity;

        if (isOutOfStock || !isAvailable) {
            hasOutOfStockItems = true;
        }

        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;
        totalQuantity += item.quantity;

        const imageUrl =
            (color.images && color.images[0]) || product.thumbnailUrl || "";

        return {
            id: item.id,
            variantId: variant.id,
            productId: product.id,
            productName: product.name,
            slug: product.slug,
            styleCode: product.styleCode,
            colorName: color.colorName,
            size: variant.size,
            sku: variant.sku,
            imageUrl,
            unitPrice,
            originalPrice,
            quantity: item.quantity,
            itemTotal,
            stockAvailable,
            isAvailable,
            isOutOfStock,
        };
    });

    return {
        cartId: cart.id,
        items,
        subtotal: Math.round(subtotal),
        totalQuantity,
        totalItems: items.length,
        hasOutOfStockItems,
    };
};

/**
 * Helper to ensure user has an initialized Cart record
 */
const getOrCreateUserCart = async (userId: string) => {
    let cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
            items: {
                include: {
                    variant: {
                        include: {
                            product: true,
                            productColor: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!cart) {
        cart = await prisma.cart.create({
            data: { userId },
            include: {
                items: {
                    include: {
                        variant: {
                            include: {
                                product: true,
                                productColor: true,
                            },
                        },
                    },
                },
            },
        });
    }

    return cart;
};

/**
 * Get customer's persistent cart with live stock & price calculation
 */
const getUserCart = async (userId: string): Promise<ICartResponse> => {
    const cart = await getOrCreateUserCart(userId);
    return formatCartResponse(cart);
};

/**
 * Add footwear size variant to customer's cart
 */
const addItemToCart = async (
    userId: string,
    payload: IAddToCartPayload
): Promise<ICartResponse> => {
    const { variantId, quantity = 1 } = payload;

    // 1. Verify shoe size variant exists
    const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
            product: true,
        },
    });

    if (!variant || !variant.isActive) {
        throw new AppError(status.NOT_FOUND, "Selected shoe size variant not found");
    }

    if (variant.stockQuantity <= 0) {
        throw new AppError(
            status.BAD_REQUEST,
            `Size ${variant.size} for '${variant.product.name}' is currently out of stock`
        );
    }

    const cart = await getOrCreateUserCart(userId);

    // 2. Check if variant is already in cart
    const existingItem = await prisma.cartItem.findUnique({
        where: {
            cartId_variantId: {
                cartId: cart.id,
                variantId,
            },
        },
    });

    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > variant.stockQuantity) {
            throw new AppError(
                status.BAD_REQUEST,
                `Cannot add more. Only ${variant.stockQuantity} pair(s) available in stock`
            );
        }

        await prisma.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: newQuantity },
        });
    } else {
        if (quantity > variant.stockQuantity) {
            throw new AppError(
                status.BAD_REQUEST,
                `Cannot add ${quantity} pairs. Only ${variant.stockQuantity} pair(s) in stock`
            );
        }

        await prisma.cartItem.create({
            data: {
                cartId: cart.id,
                variantId,
                quantity,
            },
        });
    }

    return getUserCart(userId);
};

/**
 * Update quantity of a cart item
 */
const updateCartItem = async (
    userId: string,
    itemId: string,
    payload: IUpdateCartItemPayload
): Promise<ICartResponse> => {
    const { quantity } = payload;

    const cart = await getOrCreateUserCart(userId);

    const item = await prisma.cartItem.findFirst({
        where: {
            id: itemId,
            cartId: cart.id,
        },
        include: {
            variant: true,
        },
    });

    if (!item) {
        throw new AppError(status.NOT_FOUND, "Cart item not found in your cart");
    }

    // If quantity is set to 0, remove item
    if (quantity <= 0) {
        await prisma.cartItem.delete({
            where: { id: item.id },
        });
    } else {
        if (quantity > item.variant.stockQuantity) {
            throw new AppError(
                status.BAD_REQUEST,
                `Only ${item.variant.stockQuantity} pair(s) available in stock for size ${item.variant.size}`
            );
        }

        await prisma.cartItem.update({
            where: { id: item.id },
            data: { quantity },
        });
    }

    return getUserCart(userId);
};

/**
 * Remove an item from customer's cart
 */
const removeCartItem = async (userId: string, itemId: string): Promise<ICartResponse> => {
    const cart = await getOrCreateUserCart(userId);

    const item = await prisma.cartItem.findFirst({
        where: {
            id: itemId,
            cartId: cart.id,
        },
    });

    if (!item) {
        throw new AppError(status.NOT_FOUND, "Cart item not found");
    }

    await prisma.cartItem.delete({
        where: { id: item.id },
    });

    return getUserCart(userId);
};

/**
 * Clear customer's entire cart
 */
const clearCart = async (userId: string): Promise<{ message: string }> => {
    const cart = await getOrCreateUserCart(userId);

    await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
    });

    return { message: "Your cart has been cleared successfully" };
};

/**
 * Hybrid Sync: Merge guest LocalStorage cart with user's DB cart upon login
 */
const syncCart = async (
    userId: string,
    payload: ISyncCartPayload
): Promise<ICartResponse> => {
    const { items } = payload;
    const cart = await getOrCreateUserCart(userId);

    for (const guestItem of items) {
        const variant = await prisma.productVariant.findUnique({
            where: { id: guestItem.variantId },
        });

        if (!variant || !variant.isActive || variant.stockQuantity <= 0) {
            continue;
        }

        const existingItem = await prisma.cartItem.findUnique({
            where: {
                cartId_variantId: {
                    cartId: cart.id,
                    variantId: guestItem.variantId,
                },
            },
        });

        if (existingItem) {
            const mergedQuantity = Math.min(
                existingItem.quantity + guestItem.quantity,
                variant.stockQuantity
            );

            await prisma.cartItem.update({
                where: { id: existingItem.id },
                data: { quantity: mergedQuantity },
            });
        } else {
            const validQuantity = Math.min(guestItem.quantity, variant.stockQuantity);

            await prisma.cartItem.create({
                data: {
                    cartId: cart.id,
                    variantId: guestItem.variantId,
                    quantity: validQuantity,
                },
            });
        }
    }

    return getUserCart(userId);
};

export const CartService = {
    getUserCart,
    addItemToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    syncCart,
};

