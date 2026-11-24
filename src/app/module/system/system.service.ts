/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import {
    allDivisionEN,
    districtENOf,
    thanasENOf,
} from "all-bangladeshi-addresses";
import { DeliveryZone } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import {
    ICreateBannerPayload,
    ICreateShowroomPayload,
    IUpdateBannerPayload,
    IUpdatePlatformSettingsPayload,
    IUpdateShowroomPayload,
} from "./system.interface";

// ==========================================
// 1. PLATFORM CONFIGURATION & SETTINGS
// ==========================================

/**
 * Get Platform Settings (Auto-seeds default brand configuration if missing)
 */
const getPlatformSettings = async () => {
    let settings = await prisma.platformSettings.findFirst();

    if (!settings) {
        settings = await prisma.platformSettings.create({
            data: {
                brandName: "FIFTH SENSE",
                brandNameBn: "ফিফথ সেন্স পারফিউমস",
                brandSlug: "fifth-sense",
                tagline: "Luxury Niche Perfumes & Haute Parfumerie",
                logoUrl: "https://res.cloudinary.com/rhjebh23/image/upload/v1795431915/ecombd/site-assets/fifthsenselogo.webp",
                primaryColor: "#09090b",
                secondaryColor: "#c5a059",
                accentColor: "#18181b",
                footerDescription: "Artisanal fragrances crafted with pure Grasse absolutes, aged Cambodian oud, and rare Mysore sandalwood.",
                supportPhone: "+880 1700-000000",
                whatsappNumber: "+880 1700-000000",
                messengerLink: "https://m.me/fifthsense",
                announcementText:
                    "Complimentary discovery sample included with every flacon order.",
                announcementTextBn:
                    "প্রতিটি অর্ডারের সাথে থাকছে কমপ্লিমেন্টারি ডিসকভারি স্যাম্পল।",
                insideDhakaShipping: 80,
                dhakaSubAreaShipping: 100,
                outsideDhakaShipping: 130,
                freeShippingThreshold: 5000,
                exchangeWindowDays: 7,
                maintenanceMode: false,
            },
        });
    }

    return settings;
};

/**
 * Update Platform Settings
 */
const updatePlatformSettings = async (
    payload: IUpdatePlatformSettingsPayload,
    staffId?: string
) => {
    let settings = await prisma.platformSettings.findFirst();

    if (!settings) {
        settings = await getPlatformSettings();
    }

    const updated = await prisma.platformSettings.update({
        where: { id: settings.id },
        data: payload,
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "SETTINGS_UPDATED",
                entity: "PlatformSettings",
                entityId: settings.id,
                metadata: payload as any,
            },
        });
    }

    return updated;
};

// ==========================================
// 2. CMS BANNERS
// ==========================================

/**
 * List banners with QueryBuilder (Hero slider, promo banners, announcement)
 */
const getAllBanners = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.banner, query, {
        searchableFields: ["title", "titleBn", "subtitle"],
        filterableFields: ["position", "isActive"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Get banner by ID
 */
const getBannerById = async (id: string) => {
    const banner = await prisma.banner.findUnique({
        where: { id },
    });

    if (!banner) {
        throw new AppError(status.NOT_FOUND, `Banner with ID '${id}' not found`);
    }

    return banner;
};

/**
 * Create a new Banner
 */
const createBanner = async (payload: ICreateBannerPayload, staffId?: string) => {
    const banner = await prisma.banner.create({
        data: {
            title: payload.title,
            titleBn: payload.titleBn,
            subtitle: payload.subtitle,
            subtitleBn: payload.subtitleBn,
            imageUrl: payload.imageUrl,
            mobileImgUrl: payload.mobileImgUrl,
            ctaText: payload.ctaText || "Shop Now",
            ctaLink: payload.ctaLink,
            position: payload.position,
            sortOrder: payload.sortOrder || 0,
            isActive: payload.isActive !== undefined ? payload.isActive : true,
        },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "BANNER_CREATED",
                entity: "Banner",
                entityId: banner.id,
                metadata: {
                    title: banner.title,
                    position: banner.position,
                },
            },
        });
    }

    return banner;
};

/**
 * Update an existing Banner
 */
const updateBanner = async (
    id: string,
    payload: IUpdateBannerPayload,
    staffId?: string
) => {
    const existing = await prisma.banner.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Banner with ID '${id}' not found`);
    }

    const updated = await prisma.banner.update({
        where: { id },
        data: payload,
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "BANNER_UPDATED",
                entity: "Banner",
                entityId: id,
                metadata: payload as any,
            },
        });
    }

    return updated;
};

/**
 * Delete a Banner
 */
const deleteBanner = async (id: string, staffId?: string) => {
    const existing = await prisma.banner.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Banner with ID '${id}' not found`);
    }

    await prisma.banner.delete({
        where: { id },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "BANNER_DELETED",
                entity: "Banner",
                entityId: id,
                metadata: {
                    title: existing.title,
                },
            },
        });
    }

    return { message: `Banner '${existing.title}' deleted successfully` };
};

// ==========================================
// 3. PHYSICAL SHOWROOM OUTLETS
// ==========================================

/**
 * List physical showroom locations with QueryBuilder
 */
const getAllShowrooms = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.showroomLocation, query, {
        searchableFields: ["name", "district", "thana", "fullAddress", "phoneNumber"],
        filterableFields: ["district", "isActive"],
    })
        .search()
        .filter()
        .sort()
        .paginate();

    const result = await queryBuilder.execute();
    return result;
};

/**
 * Get showroom details by ID
 */
const getShowroomById = async (id: string) => {
    const showroom = await prisma.showroomLocation.findUnique({
        where: { id },
    });

    if (!showroom) {
        throw new AppError(status.NOT_FOUND, `Showroom outlet with ID '${id}' not found`);
    }

    return showroom;
};

/**
 * Create a new showroom outlet
 */
const createShowroom = async (payload: ICreateShowroomPayload, staffId?: string) => {
    const showroom = await prisma.showroomLocation.create({
        data: {
            name: payload.name,
            district: payload.district,
            thana: payload.thana,
            fullAddress: payload.fullAddress,
            phoneNumber: payload.phoneNumber,
            googleMapUrl: payload.googleMapUrl,
            openingHours: payload.openingHours || "10:00 AM - 9:00 PM",
            isActive: payload.isActive !== undefined ? payload.isActive : true,
        },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "SHOWROOM_CREATED",
                entity: "ShowroomLocation",
                entityId: showroom.id,
                metadata: {
                    name: showroom.name,
                    district: showroom.district,
                },
            },
        });
    }

    return showroom;
};

/**
 * Update showroom outlet
 */
const updateShowroom = async (
    id: string,
    payload: IUpdateShowroomPayload,
    staffId?: string
) => {
    const existing = await prisma.showroomLocation.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Showroom outlet with ID '${id}' not found`);
    }

    const updated = await prisma.showroomLocation.update({
        where: { id },
        data: payload,
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "SHOWROOM_UPDATED",
                entity: "ShowroomLocation",
                entityId: id,
                metadata: payload as any,
            },
        });
    }

    return updated;
};

/**
 * Delete showroom outlet
 */
const deleteShowroom = async (id: string, staffId?: string) => {
    const existing = await prisma.showroomLocation.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, `Showroom outlet with ID '${id}' not found`);
    }

    await prisma.showroomLocation.delete({
        where: { id },
    });

    if (staffId) {
        await prisma.activityLog.create({
            data: {
                actorId: staffId,
                action: "SHOWROOM_DELETED",
                entity: "ShowroomLocation",
                entityId: id,
                metadata: {
                    name: existing.name,
                },
            },
        });
    }

    return { message: `Showroom '${existing.name}' deleted successfully` };
};

// ==========================================
// 4. BANGLADESH GEO LOCATIONS (SECURE BACKEND SOURCE)
// ==========================================
const getLocations = (query?: { division?: string; district?: string }) => {
    if (query?.district) {
        try {
            const thanas = [...thanasENOf(query.district as Parameters<typeof thanasENOf>[0])].sort();
            return { thanas };
        } catch {
            return { thanas: [] as string[] };
        }
    }

    if (query?.division) {
        try {
            const districts = [...districtENOf(query.division as Parameters<typeof districtENOf>[0])].sort();
            return { districts };
        } catch {
            return { districts: [] as string[] };
        }
    }

    const divisions = [...allDivisionEN()].sort();
    return { divisions };
};

const DHAKA_SUB_AREA_THANAS = new Set([
    "savar",
    "ashulia",
    "dhamrai",
    "keraniganj",
    "south keraniganj",
    "nawabganj",
    "dohar",
]);

const DHAKA_SUB_AREA_DISTRICTS = new Set(["gazipur", "narayanganj"]);

/**
 * Resolve authoritative Bangladesh delivery zone from district and thana/upazila.
 * Used by both shipping quote preview and server-side checkout order calculation.
 */
const resolveDeliveryZone = (
    _division?: string,
    district?: string,
    thana?: string
): DeliveryZone => {
    const cleanDistrict = (district || "").trim().toLowerCase();
    const cleanThana = (thana || "").trim().toLowerCase();

    if (DHAKA_SUB_AREA_DISTRICTS.has(cleanDistrict)) {
        return DeliveryZone.DHAKA_SUB_AREA;
    }

    if (cleanDistrict === "dhaka") {
        if (cleanThana && DHAKA_SUB_AREA_THANAS.has(cleanThana)) {
            return DeliveryZone.DHAKA_SUB_AREA;
        }
        return DeliveryZone.INSIDE_DHAKA;
    }

    return DeliveryZone.OUTSIDE_DHAKA;
};

/**
 * Calculate live shipping charge and free-shipping eligibility from PlatformSettings.
 */
const getShippingQuote = async (query: {
    division?: string;
    district?: string;
    thana?: string;
    subtotal?: number;
}) => {
    const deliveryZone = resolveDeliveryZone(
        query.division,
        query.district,
        query.thana
    );
    const [platformSettings, zoneRule] = await Promise.all([
        prisma.platformSettings.findFirst(),
        prisma.shippingZoneRule.findUnique({
            where: { zone: deliveryZone },
        }),
    ]);

    let baseCharge = 60;
    let label = "Inside Dhaka City";
    let eta = "24 – 48 Hours";

    if (deliveryZone === DeliveryZone.INSIDE_DHAKA) {
        baseCharge =
            platformSettings?.insideDhakaShipping ?? zoneRule?.charge ?? 60;
        label = "Inside Dhaka City";
        eta = "24 – 48 Hours";
    } else if (deliveryZone === DeliveryZone.DHAKA_SUB_AREA) {
        baseCharge =
            platformSettings?.dhakaSubAreaShipping ?? zoneRule?.charge ?? 100;
        label = "Dhaka Sub-Area (Savar, Gazipur, Narayanganj)";
        eta = "2 – 3 Days";
    } else {
        baseCharge =
            platformSettings?.outsideDhakaShipping ?? zoneRule?.charge ?? 120;
        label = "Outside Dhaka (Nationwide)";
        eta = "2 – 4 Days";
    }

    const freeShippingThreshold =
        platformSettings?.freeShippingThreshold ??
        zoneRule?.freeShippingMinAmount ??
        null;
    const subtotal = Number(query.subtotal || 0);
    const isFreeShipping =
        Boolean(freeShippingThreshold && freeShippingThreshold > 0 && subtotal >= freeShippingThreshold);

    return {
        deliveryZone,
        label,
        eta,
        baseCharge,
        charge: isFreeShipping ? 0 : baseCharge,
        isFreeShipping,
        freeShippingThreshold,
    };
};

export const SystemService = {
    getPlatformSettings,
    updatePlatformSettings,
    getAllBanners,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner,
    getAllShowrooms,
    getShowroomById,
    createShowroom,
    updateShowroom,
    deleteShowroom,
    getLocations,
    resolveDeliveryZone,
    getShippingQuote,
};

