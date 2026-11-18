/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { ICreateAddressPayload, IUpdateAddressPayload, IUpdateProfilePayload } from "./user.interface";

const getMyProfile = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            addresses: {
                orderBy: [
                    { isDefault: "desc" },
                    { createdAt: "desc" },
                ],
            },
            _count: {
                select: {
                    orders: true,
                    reviews: true,
                    wishlists: true,
                },
            },
        },
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User profile not found");
    }

    return user;
};

const updateMyProfile = async (
    userId: string,
    payload: IUpdateProfilePayload,
    file?: Express.Multer.File
) => {
    const isUserExist = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!isUserExist) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    const imageUrl = file?.path || payload.image;

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            ...(payload.name && { name: payload.name }),
            ...(payload.phoneNumber && { phoneNumber: payload.phoneNumber }),
            ...(payload.gender && { gender: payload.gender }),
            ...(payload.birthdate && { birthdate: new Date(payload.birthdate) }),
            ...(payload.address && { address: payload.address }),
            ...(payload.savedShoeSize && { savedShoeSize: payload.savedShoeSize }),
            ...(payload.bio && { bio: payload.bio }),
            ...(imageUrl && { image: imageUrl }),
        },
        include: {
            addresses: true,
        },
    });

    return updatedUser;
};

const getMyAddresses = async (userId: string) => {
    const addresses = await prisma.customerAddress.findMany({
        where: { userId },
        orderBy: [
            { isDefault: "desc" },
            { createdAt: "desc" },
        ],
    });

    return addresses;
};

const createAddress = async (userId: string, payload: ICreateAddressPayload) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    const existingAddressesCount = await prisma.customerAddress.count({
        where: { userId },
    });

    // If it's user's first address or marked as default, set isDefault to true
    const shouldBeDefault = existingAddressesCount === 0 || payload.isDefault === true;

    if (shouldBeDefault && existingAddressesCount > 0) {
        // Reset previous default addresses
        await prisma.customerAddress.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
        });
    }

    const newAddress = await prisma.customerAddress.create({
        data: {
            userId,
            label: payload.label || "Home",
            recipientName: payload.recipientName,
            phoneNumber: payload.phoneNumber,
            division: payload.division,
            district: payload.district,
            thana: payload.thana,
            fullAddress: payload.fullAddress,
            deliveryZone: payload.deliveryZone,
            isDefault: shouldBeDefault,
        },
    });

    return newAddress;
};

const updateAddress = async (
    userId: string,
    addressId: string,
    payload: IUpdateAddressPayload
) => {
    const existingAddress = await prisma.customerAddress.findFirst({
        where: {
            id: addressId,
            userId,
        },
    });

    if (!existingAddress) {
        throw new AppError(status.NOT_FOUND, "Address not found or does not belong to you");
    }

    if (payload.isDefault === true && !existingAddress.isDefault) {
        await prisma.customerAddress.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
        });
    }

    const updated = await prisma.customerAddress.update({
        where: { id: addressId },
        data: {
            ...(payload.label !== undefined && { label: payload.label }),
            ...(payload.recipientName && { recipientName: payload.recipientName }),
            ...(payload.phoneNumber && { phoneNumber: payload.phoneNumber }),
            ...(payload.division && { division: payload.division }),
            ...(payload.district && { district: payload.district }),
            ...(payload.thana && { thana: payload.thana }),
            ...(payload.fullAddress && { fullAddress: payload.fullAddress }),
            ...(payload.deliveryZone && { deliveryZone: payload.deliveryZone }),
            ...(payload.isDefault !== undefined && { isDefault: payload.isDefault }),
        },
    });

    return updated;
};

const deleteAddress = async (userId: string, addressId: string) => {
    const existingAddress = await prisma.customerAddress.findFirst({
        where: {
            id: addressId,
            userId,
        },
    });

    if (!existingAddress) {
        throw new AppError(status.NOT_FOUND, "Address not found or does not belong to you");
    }

    await prisma.customerAddress.delete({
        where: { id: addressId },
    });

    // If deleted address was default, make another one default
    if (existingAddress.isDefault) {
        const nextAddress = await prisma.customerAddress.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });

        if (nextAddress) {
            await prisma.customerAddress.update({
                where: { id: nextAddress.id },
                data: { isDefault: true },
            });
        }
    }

    return { message: "Address deleted successfully" };
};

const getAllCustomers = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.user, query, {
        searchableFields: ["name", "email", "phoneNumber"],
        filterableFields: ["status", "savedShoeSize"],
    })
        .where({
            role: Role.CUSTOMER,
            isDeleted: false,
        })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            addresses: true,
            _count: {
                select: {
                    orders: true,
                },
            },
        });

    return await queryBuilder.execute();
};

const getCustomerById = async (id: string) => {
    const customer = await prisma.user.findFirst({
        where: {
            id,
            role: Role.CUSTOMER,
            isDeleted: false,
        },
        include: {
            addresses: true,
            orders: {
                take: 10,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    totalAmount: true,
                    createdAt: true,
                },
            },
            _count: {
                select: {
                    orders: true,
                    reviews: true,
                    wishlists: true,
                },
            },
        },
    });

    if (!customer) {
        throw new AppError(status.NOT_FOUND, "Customer not found");
    }

    return customer;
};

export const UserService = {
    getMyProfile,
    updateMyProfile,
    getMyAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    getAllCustomers,
    getCustomerById,
};
