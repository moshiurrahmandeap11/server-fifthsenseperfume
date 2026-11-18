/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { FraudRiskLevel, Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { IBlacklistPayload, ICreateStaffPayload, IUpdateStaffPayload } from "./admin.interface";

const getAllStaff = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.user, query, {
        searchableFields: ["name", "email", "phoneNumber"],
        filterableFields: ["role", "status"],
    })
        .where({
            role: { not: Role.CUSTOMER },
            isDeleted: false,
        })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            admin: true,
        });

    return await queryBuilder.execute();
};

const getStaffById = async (id: string) => {
    const staff = await prisma.user.findFirst({
        where: {
            id,
            role: {
                not: Role.CUSTOMER,
            },
            isDeleted: false,
        },
        include: {
            admin: true,
        },
    });

    if (!staff) {
        throw new AppError(status.NOT_FOUND, "Staff member not found");
    }

    return staff;
};

const createStaff = async (payload: ICreateStaffPayload) => {
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email: payload.email },
                ...(payload.phoneNumber ? [{ phoneNumber: payload.phoneNumber }] : []),
            ],
        },
    });

    if (existingUser) {
        throw new AppError(status.CONFLICT, "User with this email or phone number already exists");
    }

    // Create user via Better Auth for password hashing and authentication credentials
    const signUpResult = await auth.api.signUpEmail({
        body: {
            name: payload.name,
            email: payload.email,
            password: payload.password,
            role: payload.role,
            phoneNumber: payload.phoneNumber,
        },
    });

    if (!signUpResult || !signUpResult.user) {
        throw new AppError(status.BAD_REQUEST, "Failed to create staff account");
    }

    // Set verified email and assigned role for internal staff created by Super Admin
    await prisma.user.update({
        where: { id: signUpResult.user.id },
        data: {
            emailVerified: true,
            role: payload.role,
        },
    });

    // Create associated Admin metadata record
    const adminProfile = await prisma.admin.create({
        data: {
            userId: signUpResult.user.id,
            name: payload.name,
            email: payload.email,
            contactNumber: payload.phoneNumber,
            profilePhoto: payload.profilePhoto,
        },
    });

    return {
        ...signUpResult.user,
        role: payload.role,
        admin: adminProfile,
    };
};

const updateStaff = async (id: string, payload: IUpdateStaffPayload) => {
    const existingStaff = await prisma.user.findFirst({
        where: {
            id,
            role: { not: Role.CUSTOMER },
            isDeleted: false,
        },
        include: { admin: true },
    });

    if (!existingStaff) {
        throw new AppError(status.NOT_FOUND, "Staff member not found");
    }

    if (existingStaff.role === Role.SUPER_ADMIN && payload.role && payload.role !== Role.SUPER_ADMIN) {
        throw new AppError(status.FORBIDDEN, "Cannot demote a Super Admin");
    }

    const { name, phoneNumber, profilePhoto, role, status: userStatus } = payload;

    const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(phoneNumber && { phoneNumber }),
                ...(profilePhoto && { image: profilePhoto }),
                ...(role && { role }),
                ...(userStatus && { status: userStatus }),
            },
            include: { admin: true },
        }),
        ...(existingStaff.admin
            ? [
                  prisma.admin.update({
                      where: { userId: id },
                      data: {
                          ...(name && { name }),
                          ...(phoneNumber && { contactNumber: phoneNumber }),
                          ...(profilePhoto && { profilePhoto }),
                      },
                  }),
              ]
            : []),
    ]);

    // If staff is suspended or blocked, invalidate all active sessions
    if (userStatus && userStatus !== UserStatus.ACTIVE) {
        await prisma.session.deleteMany({
            where: { userId: id },
        });
    }

    return updatedUser;
};

const deleteStaff = async (id: string, currentUserId: string) => {
    if (id === currentUserId) {
        throw new AppError(status.BAD_REQUEST, "You cannot delete your own account");
    }

    const staff = await prisma.user.findFirst({
        where: { id, isDeleted: false },
    });

    if (!staff) {
        throw new AppError(status.NOT_FOUND, "Staff member not found");
    }

    if (staff.role === Role.SUPER_ADMIN) {
        throw new AppError(status.FORBIDDEN, "Super Admin accounts cannot be deleted");
    }

    // Soft delete staff and revoke sessions
    const deleted = await prisma.user.update({
        where: { id },
        data: {
            isDeleted: true,
            status: UserStatus.DELETED,
            deletedAt: new Date(),
        },
    });

    await prisma.session.deleteMany({
        where: { userId: id },
    });

    return deleted;
};

const getActivityLogs = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.activityLog, query, {
        searchableFields: ["action", "entity", "entityId"],
        filterableFields: ["actorId", "action", "entity"],
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            actor: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
            },
        });

    return await queryBuilder.execute();
};

const getBlacklist = async (query: Record<string, any>) => {
    const queryBuilder = new QueryBuilder(prisma.customerFraudScore, query, {
        searchableFields: ["phoneNumber", "blacklistReason"],
        filterableFields: ["riskLevel"],
    })
        .where({
            isBlacklisted: true,
        })
        .search()
        .filter()
        .sort()
        .paginate();

    return await queryBuilder.execute();
};

const addToBlacklist = async (payload: IBlacklistPayload) => {
    const result = await prisma.customerFraudScore.upsert({
        where: { phoneNumber: payload.phoneNumber },
        update: {
            isBlacklisted: true,
            blacklistReason: payload.reason,
            riskLevel: payload.riskLevel || FraudRiskLevel.HIGH_RISK,
            blacklistedAt: new Date(),
            lastCheckedAt: new Date(),
        },
        create: {
            phoneNumber: payload.phoneNumber,
            isBlacklisted: true,
            blacklistReason: payload.reason,
            riskLevel: payload.riskLevel || FraudRiskLevel.HIGH_RISK,
            blacklistedAt: new Date(),
        },
    });

    return result;
};

const removeFromBlacklist = async (id: string) => {
    const existing = await prisma.customerFraudScore.findFirst({
        where: {
            OR: [{ id }, { phoneNumber: id }],
            isBlacklisted: true,
        },
    });

    if (!existing) {
        throw new AppError(status.NOT_FOUND, "Blacklisted customer record not found");
    }

    const result = await prisma.customerFraudScore.update({
        where: { id: existing.id },
        data: {
            isBlacklisted: false,
            blacklistReason: null,
            riskLevel: FraudRiskLevel.SAFE,
        },
    });

    return result;
};

export const AdminService = {
    getAllStaff,
    getStaffById,
    createStaff,
    updateStaff,
    deleteStaff,
    getActivityLogs,
    getBlacklist,
    addToBlacklist,
    removeFromBlacklist,
};
