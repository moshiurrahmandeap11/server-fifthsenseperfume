/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { IChangePasswordPayload, ILoginUserPayload, IRegisterUserPayload } from "./auth.interface";

const registerUser = async (payload: IRegisterUserPayload) => {
    const { name, email, password, birthdate, gender, phoneNumber, address, savedShoeSize } = payload;

    const data = await auth.api.signUpEmail({
        body: {
            name,
            email,
            password,
            role: Role.CUSTOMER,
            birthdate: birthdate ? new Date(birthdate) : undefined,
            gender: gender || undefined,
            phoneNumber: phoneNumber || undefined,
            address: address || undefined,
            savedShoeSize: savedShoeSize || undefined,
        },
    });

    if (!data.user) {
        throw new AppError(status.BAD_REQUEST, "Failed to register user");
    }

    return data;
};

const loginUser = async (payload: ILoginUserPayload) => {
    const { email, password } = payload;

    const data = await auth.api.signInEmail({
        body: {
            email,
            password,
        },
    });

    if (data.user.status === UserStatus.BLOCKED || (data.user as any).isBanned) {
        throw new AppError(status.FORBIDDEN, "User account is blocked");
    }

    if (data.user.isDeleted || data.user.status === UserStatus.DELETED) {
        throw new AppError(status.NOT_FOUND, "User account has been deleted");
    }

    return data;
};

const getMe = async (user: IRequestUser) => {
    const isUserExists = await prisma.user.findUnique({
        where: {
            id: user.userId,
        },
        include: {
            admin: true,
            addresses: true,
        },
    });

    if (!isUserExists) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    return isUserExists;
};

const changePassword = async (payload: IChangePasswordPayload, headers: Headers) => {
    const { currentPassword, newPassword } = payload;

    const result = await auth.api.changePassword({
        body: {
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
        },
        headers,
    });

    const session = await auth.api.getSession({ headers });
    if (session?.user && (session.user as any).needPasswordChange) {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { needPasswordChange: false },
        });
    }

    return result;
};

const logoutUser = async (headers: Headers) => {
    const result = await auth.api.signOut({
        headers,
    });
    return result;
};

const verifyEmail = async (email: string, otp: string) => {
    const result = await auth.api.verifyEmailOTP({
        body: {
            email,
            otp,
        },
    });

    if (result.status) {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            try {
                await sendEmail({
                    to: user.email,
                    subject: "Welcome to EcomBD Footwear!",
                    templateName: "welcome",
                    templateData: {
                        name: user.name,
                        email: user.email,
                        dashboardUrl: `${envVars.FRONTEND_URL}/account`,
                    },
                });
            } catch (emailError) {
                console.error("Error sending welcome email:", emailError);
            }

            return {
                ...result,
                user,
            };
        }
    }

    return result;
};

const requestEmailOTP = async (email: string) => {
    const isUserExist = await prisma.user.findUnique({
        where: { email },
    });

    if (!isUserExist) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (isUserExist.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email is already verified");
    }

    await auth.api.sendVerificationOTP({
        body: {
            email,
            type: "email-verification",
        },
    });
};

const forgetPassword = async (email: string) => {
    const isUserExist = await prisma.user.findUnique({
        where: { email },
    });

    if (!isUserExist) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (!isUserExist.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email not verified");
    }

    if (isUserExist.isDeleted || isUserExist.status === UserStatus.DELETED) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    await auth.api.requestPasswordResetEmailOTP({
        body: { email },
    });
};

const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const isUserExist = await prisma.user.findUnique({
        where: { email },
    });

    if (!isUserExist) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    if (!isUserExist.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "Email not verified");
    }

    if (isUserExist.isDeleted || isUserExist.status === UserStatus.DELETED) {
        throw new AppError(status.NOT_FOUND, "User not found");
    }

    await auth.api.resetPasswordEmailOTP({
        body: {
            email,
            otp,
            password: newPassword,
        },
    });

    if (isUserExist.needPasswordChange) {
        await prisma.user.update({
            where: { id: isUserExist.id },
            data: { needPasswordChange: false },
        });
    }

    await prisma.session.deleteMany({
        where: { userId: isUserExist.id },
    });
};

const googleLoginSuccess = async (session: Record<string, any>) => {
    return {
        sessionToken: session.session.token,
        user: session.user,
    };
};

export const AuthService = {
    registerUser,
    loginUser,
    getMe,
    changePassword,
    logoutUser,
    verifyEmail,
    requestEmailOTP,
    forgetPassword,
    resetPassword,
    googleLoginSuccess,
};
