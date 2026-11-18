/* eslint-disable @typescript-eslint/no-explicit-any */
import { fromNodeHeaders } from "better-auth/node";
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { Role, UserStatus } from "../../generated/prisma/enums";
import AppError from "../errorHelpers/AppError";
import { auth } from "../lib/auth";

export const checkAuth = (...authRoles: Role[]) => async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session || !session.user) {
            throw new AppError(status.UNAUTHORIZED, "Unauthorized access! Please log in.");
        }

        const user = session.user as any;

        if (user.status === UserStatus.BLOCKED || user.status === UserStatus.DELETED || user.isBanned) {
            throw new AppError(status.FORBIDDEN, "Access forbidden! Account is blocked or suspended.");
        }

        if (user.isDeleted) {
            throw new AppError(status.NOT_FOUND, "Account has been deleted.");
        }

        req.user = {
            userId: user.id,
            role: user.role as Role,
            email: user.email,
        };

        if (authRoles.length > 0 && !authRoles.includes(req.user.role)) {
            throw new AppError(status.FORBIDDEN, "Forbidden access! You do not have permission to access this resource.");
        }

        next();
    } catch (error: any) {
        next(error);
    }
};

/**
 * Middleware that attempts to populate req.user if a valid Better Auth session is present,
 * but does NOT block the request if the user is unauthenticated (e.g. Guest Checkout).
 */
export const parseUser = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (session && session.user) {
            const user = session.user as any;
            req.user = {
                userId: user.id,
                role: user.role as Role,
                email: user.email,
            };
        }

        next();
    } catch {
        next();
    }
};
