import { BannerPosition } from "../../../generated/prisma/enums";

export interface IUpdatePlatformSettingsPayload {
    brandName?: string;
    brandNameBn?: string;
    logoUrl?: string;
    faviconUrl?: string;
    supportPhone?: string;
    whatsappNumber?: string;
    messengerLink?: string;
    announcementText?: string;
    announcementTextBn?: string;
    insideDhakaShipping?: number;
    dhakaSubAreaShipping?: number;
    outsideDhakaShipping?: number;
    freeShippingThreshold?: number | null;
    metaPixelId?: string;
    metaCapiAccessToken?: string;
    sendCapiOnConfirmOnly?: boolean;
    tiktokPixelId?: string;
    exchangeWindowDays?: number;
    maintenanceMode?: boolean;
}

export interface ICreateBannerPayload {
    title: string;
    titleBn?: string;
    subtitle?: string;
    subtitleBn?: string;
    imageUrl: string;
    mobileImgUrl?: string;
    ctaText?: string;
    ctaLink?: string;
    position?: BannerPosition;
    sortOrder?: number;
    isActive?: boolean;
}

export interface IUpdateBannerPayload {
    title?: string;
    titleBn?: string;
    subtitle?: string;
    subtitleBn?: string;
    imageUrl?: string;
    mobileImgUrl?: string;
    ctaText?: string;
    ctaLink?: string;
    position?: BannerPosition;
    sortOrder?: number;
    isActive?: boolean;
}

export interface ICreateShowroomPayload {
    name: string;
    district: string;
    thana: string;
    fullAddress: string;
    phoneNumber: string;
    googleMapUrl?: string;
    openingHours?: string;
    isActive?: boolean;
}

export interface IUpdateShowroomPayload {
    name?: string;
    district?: string;
    thana?: string;
    fullAddress?: string;
    phoneNumber?: string;
    googleMapUrl?: string;
    openingHours?: string;
    isActive?: boolean;
}

