/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import slugify from "slugify";
import { DiscountType } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
    IApplyCouponPayload,
    IApplyCouponResult,
    ICreateCouponPayload,
    ICreateFlashSalePayload,
    ICreateLandingPagePayload,
    ITestCapiPayload,
    IUpdateCouponPayload,
    IUpdateFlashSalePayload,
    IUpdateLandingPagePayload,
} from "./marketing.interface";

// ==========================================
// 1. COUPON MANAGEMENT & EVALUATION
// ==========================================

/**
 * Validate coupon code and compute footwear discount
 */
const applyCoupon = async (payload: IApplyCouponPayload): Promise<IApplyCouponResult> => {
    const { code, cartSubtotal, totalPairs = 1, isPrepaid = false } = payload;
    const normalizedCode = code.trim().toUpperCase();

    const coupon = await prisma.coupon.findUnique({
        where: { code: normalizedCode },
    });

    if (!coupon || !coupon.isActive) {
        throw new AppError(status.NOT_FOUND, `Invalid or inactive coupon code: '${code}'`);
    }

    const now = new Date();

    // Check Start Date
    if (new Date(coupon.startsAt) > now) {
        throw new AppError(status.BAD_REQUEST, "This coupon promotion has not started yet");
    }

    // Check Expiration
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
        throw new AppError(status.BAD_REQUEST, "This coupon has already expired");
    }

    // Check Usage Limit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new AppError(status.BAD_REQUEST, "This coupon's maximum usage limit has been reached");
    }

    // Check Minimum Order Amount
    if (cartSubtotal < coupon.minOrderAmount) {
        throw new AppError(
            status.BAD_REQUEST,
            `Minimum order amount of ৳${coupon.minOrderAmount} required for this coupon`
        );
    }

    // Check Minimum Pair / Item Count
    if (totalPairs < coupon.minPairCount) {
        throw new AppError(
            status.BAD_REQUEST,
            `Minimum ${coupon.minPairCount} item(s) required to apply this coupon`
        );
    }

    // Check Prepaid-Only Restriction (e.g. Card exclusive promo)
    if (coupon.onlyPrepaid && !isPrepaid) {
        throw new AppError(
            status.BAD_REQUEST,
            "This coupon is exclusively valid for prepaid card orders"
        );
    }

    // Calculate Discount
    let discountAmount = 0;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
        discountAmount = (cartSubtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
            discountAmount = coupon.maxDiscountAmount;
        }
    } else if (coupon.discountType === DiscountType.FIXED) {
        discountAmount = Math.min(cartSubtotal, coupon.discountValue);
    } else if (coupon.discountType === DiscountType.FREE_SHIPPING) {
        discountAmount = coupon.discountValue || 130;
    }

    discountAmount = Math.round(discountAmount);
    const finalPayable = Math.max(0, cartSubtotal - discountAmount);

    return {
        isValid: true,
        couponId: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        finalPayable,
        message: `Coupon '${coupon.code}' applied successfully`,
    };
};

/**
 * List coupons with QueryBuilder
 */
const getAllCoupons = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.coupon, query, {
        searchableFields: ["code", "description"],
        filterableFields: ["discountType", "isActive", "onlyPrepaid"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    queryBuilder.include({
        _count: {
            select: { orders: true },
        },
    });

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Get single coupon by ID or code
 */
const getCouponById = async (idOrCode: string) => {
    const coupon = await prisma.coupon.findFirst({
        where: {
            OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }],
        },
        include: {
            _count: {
                select: { orders: true },
            },
        },
    });

    if (!coupon) {
        throw new AppError(status.NOT_FOUND, `Coupon '${idOrCode}' not found`);
    }

    return coupon;
};

/**
 * Create a new coupon
 */
const createCoupon = async (payload: ICreateCouponPayload) => {
    const normalizedCode = payload.code.trim().toUpperCase();

    const existing = await prisma.coupon.findUnique({
        where: { code: normalizedCode },
    });

    if (existing) {
        throw new AppError(status.CONFLICT, `Coupon code '${normalizedCode}' already exists`);
    }

    const coupon = await prisma.coupon.create({
        data: {
            code: normalizedCode,
            description: payload.description,
            discountType: payload.discountType,
            discountValue: payload.discountValue,
            minOrderAmount: payload.minOrderAmount || 0,
            minPairCount: payload.minPairCount || 1,
            maxDiscountAmount: payload.maxDiscountAmount ?? null,
            onlyPrepaid: payload.onlyPrepaid || false,
            startsAt: payload.startsAt ? new Date(payload.startsAt) : new Date(),
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            usageLimit: payload.usageLimit ?? null,
            isActive: payload.isActive !== undefined ? payload.isActive : true,
        },
    });

    return coupon;
};

/**
 * Update an existing coupon
 */
const updateCoupon = async (id: string, payload: IUpdateCouponPayload) => {
    const existing = await prisma.coupon.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Coupon with ID '${id}' not found`);
    }

    if (payload.code) {
        const normalizedCode = payload.code.trim().toUpperCase();
        if (normalizedCode !== existing.code) {
            const conflict = await prisma.coupon.findUnique({
                where: { code: normalizedCode },
            });
            if (conflict) {
                throw new AppError(status.CONFLICT, `Coupon code '${normalizedCode}' already in use`);
            }
        }
    }

    const updated = await prisma.coupon.update({
        where: { id },
        data: {
            code: payload.code ? payload.code.trim().toUpperCase() : undefined,
            description: payload.description,
            discountType: payload.discountType,
            discountValue: payload.discountValue,
            minOrderAmount: payload.minOrderAmount,
            minPairCount: payload.minPairCount,
            maxDiscountAmount: payload.maxDiscountAmount,
            onlyPrepaid: payload.onlyPrepaid,
            startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
            expiresAt: payload.expiresAt !== undefined ? (payload.expiresAt ? new Date(payload.expiresAt) : null) : undefined,
            usageLimit: payload.usageLimit,
            isActive: payload.isActive,
        },
    });

    return updated;
};

/**
 * Delete a coupon
 */
const deleteCoupon = async (id: string) => {
    const existing = await prisma.coupon.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Coupon with ID '${id}' not found`);
    }

    await prisma.coupon.delete({
        where: { id },
    });

    return { message: `Coupon '${existing.code}' deleted successfully` };
};

// ==========================================
// 2. FLASH SALE CAMPAIGNS
// ==========================================

/**
 * Get currently running active Flash Sale for homepage/header countdown
 */
const getActiveFlashSale = async () => {
    const now = new Date();

    const flashSale = await prisma.flashSale.findFirst({
        where: {
            isActive: true,
            startsAt: { lte: now },
            endsAt: { gte: now },
        },
        include: {
            items: {
                orderBy: { sortOrder: "asc" },
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            styleCode: true,
                            basePrice: true,
                            thumbnailUrl: true,
                            gender: true,
                            colors: {
                                select: {
                                    id: true,
                                    colorName: true,
                                    images: true,
                                    variants: {
                                        select: {
                                            id: true,
                                            size: true,
                                            stockQuantity: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { startsAt: "desc" },
    });

    return flashSale;
};

/**
 * List all Flash Sale campaigns with QueryBuilder
 */
const getAllFlashSales = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.flashSale, query, {
        searchableFields: ["title", "titleBn", "slug"],
        filterableFields: ["isActive"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    queryBuilder.include({
        _count: {
            select: { items: true },
        },
    });

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Get Flash Sale by ID or Slug
 */
const getFlashSaleByIdOrSlug = async (idOrSlug: string) => {
    const flashSale = await prisma.flashSale.findFirst({
        where: {
            OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        },
        include: {
            items: {
                orderBy: { sortOrder: "asc" },
                include: {
                    product: {
                        include: {
                            colors: {
                                include: {
                                    variants: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!flashSale) {
        throw new AppError(status.NOT_FOUND, `Flash sale '${idOrSlug}' not found`);
    }

    return flashSale;
};

/**
 * Create a new Flash Sale campaign with product items
 */
const createFlashSale = async (payload: ICreateFlashSalePayload) => {
    const { title, titleBn, bannerImage, startsAt, endsAt, isActive = true, items } = payload;

    const baseSlug = payload.slug || slugify(title, { lower: true, strict: true });
    let finalSlug = baseSlug;

    // Check slug collision
    const existing = await prisma.flashSale.findUnique({
        where: { slug: baseSlug },
    });
    if (existing) {
        finalSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    const flashSale = await prisma.flashSale.create({
        data: {
            title,
            titleBn,
            slug: finalSlug,
            bannerImage,
            startsAt: new Date(startsAt),
            endsAt: new Date(endsAt),
            isActive,
            items: items && items.length > 0
                ? {
                      create: items.map((item, index) => ({
                          productId: item.productId,
                          flashSalePrice: item.flashSalePrice,
                          sortOrder: item.sortOrder !== undefined ? item.sortOrder : index,
                      })),
                  }
                : undefined,
        },
        include: {
            items: {
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            basePrice: true,
                            thumbnailUrl: true,
                        },
                    },
                },
            },
        },
    });

    return flashSale;
};

/**
 * Update Flash Sale campaign and items
 */
const updateFlashSale = async (id: string, payload: IUpdateFlashSalePayload) => {
    const existing = await prisma.flashSale.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Flash sale with ID '${id}' not found`);
    }

    // Atomic update
    const updated = await prisma.$transaction(async (tx) => {
        // If items specified, refresh items
        if (payload.items) {
            await tx.flashSaleItem.deleteMany({
                where: { flashSaleId: id },
            });

            if (payload.items.length > 0) {
                await tx.flashSaleItem.createMany({
                    data: payload.items.map((item, index) => ({
                        flashSaleId: id,
                        productId: item.productId,
                        flashSalePrice: item.flashSalePrice,
                        sortOrder: item.sortOrder !== undefined ? item.sortOrder : index,
                    })),
                });
            }
        }

        return tx.flashSale.update({
            where: { id },
            data: {
                title: payload.title,
                titleBn: payload.titleBn,
                slug: payload.slug,
                bannerImage: payload.bannerImage,
                startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
                endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
                isActive: payload.isActive,
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                basePrice: true,
                                thumbnailUrl: true,
                            },
                        },
                    },
                },
            },
        });
    });

    return updated;
};

/**
 * Delete Flash Sale campaign
 */
const deleteFlashSale = async (id: string) => {
    const existing = await prisma.flashSale.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Flash sale with ID '${id}' not found`);
    }

    await prisma.flashSale.delete({
        where: { id },
    });

    return { message: `Flash sale '${existing.title}' deleted successfully` };
};

// ==========================================
// 3. CAMPAIGN LANDING PAGES (Ad Funnels)
// ==========================================

/**
 * Get Public Campaign Landing Page by slug (for direct Meta/TikTok ad traffic)
 */
const getLandingPageBySlug = async (slug: string) => {
    const landingPage = await prisma.campaignLandingPage.findFirst({
        where: {
            OR: [{ slug }, { id: slug }],
            isActive: true,
        },
        include: {
            product: {
                include: {
                    sizeChart: true,
                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    colors: {
                        include: {
                            variants: {
                                select: {
                                    id: true,
                                    size: true,
                                    ukSize: true,
                                    usSize: true,
                                    footLengthCm: true,
                                    stockQuantity: true,
                                    sku: true,
                                },
                            },
                        },
                    },
                    reviews: {
                        where: { isApproved: true },
                        take: 10,
                        orderBy: { rating: "desc" },
                        select: {
                            id: true,
                            rating: true,
                            comment: true,
                            customerName: true,
                            purchasedSize: true,
                            fitFeedback: true,
                            images: true,
                            createdAt: true,
                        },
                    },
                },
            },
        },
    });

    if (!landingPage) {
        throw new AppError(status.NOT_FOUND, `Landing page '${slug}' not found or inactive`);
    }

    return landingPage;
};

/**
 * List Campaign Landing Pages with QueryBuilder
 */
const getAllLandingPages = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.campaignLandingPage, query, {
        searchableFields: ["title", "headline", "slug"],
        filterableFields: ["isActive", "productId", "freeDelivery"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    queryBuilder.include({
        product: {
            select: {
                id: true,
                name: true,
                styleCode: true,
                basePrice: true,
                thumbnailUrl: true,
            },
        },
    });

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Create a new Campaign Landing Page
 */
const createLandingPage = async (payload: ICreateLandingPagePayload) => {
    const {
        title,
        productId,
        headline,
        subheadline,
        heroVideoUrl,
        bannerImages,
        featureBullets,
        offerPrice,
        freeDelivery = false,
        showSizeChart = true,
        isActive = true,
    } = payload;

    // Verify product exists
    const product = await prisma.product.findUnique({
        where: { id: productId },
    });

    if (!product) {
        throw new AppError(status.NOT_FOUND, "Target product for landing page not found");
    }

    const baseSlug = payload.slug || slugify(title, { lower: true, strict: true });
    let finalSlug = baseSlug;

    const existingSlug = await prisma.campaignLandingPage.findUnique({
        where: { slug: baseSlug },
    });
    if (existingSlug) {
        finalSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    const landingPage = await prisma.campaignLandingPage.create({
        data: {
            title,
            slug: finalSlug,
            productId,
            headline,
            subheadline,
            heroVideoUrl,
            bannerImages: bannerImages || [],
            featureBullets: featureBullets || [],
            offerPrice: offerPrice ?? null,
            freeDelivery,
            showSizeChart,
            isActive,
        },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    basePrice: true,
                    thumbnailUrl: true,
                },
            },
        },
    });

    return landingPage;
};

/**
 * Update Campaign Landing Page
 */
const updateLandingPage = async (id: string, payload: IUpdateLandingPagePayload) => {
    const existing = await prisma.campaignLandingPage.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Landing page with ID '${id}' not found`);
    }

    const updated = await prisma.campaignLandingPage.update({
        where: { id },
        data: {
            title: payload.title,
            slug: payload.slug,
            productId: payload.productId,
            headline: payload.headline,
            subheadline: payload.subheadline,
            heroVideoUrl: payload.heroVideoUrl,
            bannerImages: payload.bannerImages,
            featureBullets: payload.featureBullets,
            offerPrice: payload.offerPrice,
            freeDelivery: payload.freeDelivery,
            showSizeChart: payload.showSizeChart,
            isActive: payload.isActive,
        },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    basePrice: true,
                    thumbnailUrl: true,
                },
            },
        },
    });

    return updated;
};

/**
 * Delete Campaign Landing Page
 */
const deleteLandingPage = async (id: string) => {
    const existing = await prisma.campaignLandingPage.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Landing page with ID '${id}' not found`);
    }

    await prisma.campaignLandingPage.delete({
        where: { id },
    });

    return { message: `Landing page '${existing.title}' deleted successfully` };
};

// ==========================================
// 4. META CONVERSIONS API (CAPI) TESTER
// ==========================================

/**
 * Test Meta Conversions API (CAPI) server event dispatcher
 */
const testCapiEvent = async (
    payload: ITestCapiPayload,
    clientIp?: string,
    clientUserAgent?: string
) => {
    const { eventName, orderId, customerPhone, customerEmail, amount, fbp, fbc } = payload;

    const eventTime = Math.floor(Date.now() / 1000);
    const eventId = `CAPI-TEST-${Date.now()}`;

    const eventData = {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        user_data: {
            client_ip_address: clientIp || "127.0.0.1",
            client_user_agent: clientUserAgent || "Antigravity/EcomBD-Agent",
            ph: customerPhone ? [customerPhone] : undefined,
            em: customerEmail ? [customerEmail] : undefined,
            fbp: fbp || undefined,
            fbc: fbc || undefined,
        },
        custom_data: {
            currency: "BDT",
            value: amount || 2500,
            order_id: orderId || `TEST-ORD-${Date.now().toString().slice(-4)}`,
        },
    };

    // If Meta CAPI credentials exist in environment, dispatch request to Meta Graph API
    if (envVars.META.META_PIXEL_ID && envVars.META.META_CAPI_ACCESS_TOKEN) {
        try {
            const metaUrl = `https://graph.facebook.com/v19.0/${envVars.META.META_PIXEL_ID}/events?access_token=${envVars.META.META_CAPI_ACCESS_TOKEN}`;
            const metaRes = await fetch(metaUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: [eventData],
                }),
            });

            const metaResponseJson = await metaRes.json();
            return {
                status: "DISPATCHED_TO_META",
                pixelId: envVars.META.META_PIXEL_ID,
                metaResponse: metaResponseJson,
                payloadSent: eventData,
            };
        } catch (error: any) {
            return {
                status: "DISPATCH_FAILED",
                error: error.message,
                payloadSent: eventData,
            };
        }
    }

    // Sandbox simulated response
    return {
        status: "SIMULATED_SUCCESS",
        message:
            "Meta Pixel ID or Access Token not configured in .env. Test payload validated successfully.",
        eventData,
    };
};

export const MarketingService = {
    applyCoupon,
    getAllCoupons,
    getCouponById,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    getActiveFlashSale,
    getAllFlashSales,
    getFlashSaleByIdOrSlug,
    createFlashSale,
    updateFlashSale,
    deleteFlashSale,
    getLandingPageBySlug,
    getAllLandingPages,
    createLandingPage,
    updateLandingPage,
    deleteLandingPage,
    testCapiEvent,
};
