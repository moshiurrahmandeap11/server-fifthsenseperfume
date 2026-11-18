import { DeliveryZone, Gender } from "../../../generated/prisma/enums";

export interface IUpdateProfilePayload {
    name?: string;
    phoneNumber?: string;
    gender?: Gender;
    birthdate?: string;
    address?: string;
    savedShoeSize?: string;
    image?: string;
    bio?: string;
}

export interface ICreateAddressPayload {
    label?: string; // e.g. "Home", "Office"
    recipientName: string;
    phoneNumber: string;
    division: string;
    district: string;
    thana: string;
    fullAddress: string;
    deliveryZone?: DeliveryZone;
    isDefault?: boolean;
}

export interface IUpdateAddressPayload {
    label?: string;
    recipientName?: string;
    phoneNumber?: string;
    division?: string;
    district?: string;
    thana?: string;
    fullAddress?: string;
    deliveryZone?: DeliveryZone;
    isDefault?: boolean;
}
