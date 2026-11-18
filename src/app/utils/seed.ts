import { Role } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

export const seedAdmin = async () => {
    try {
        const isAdminExist = await prisma.user.findFirst({
            where: {
                role: {
                    in: [Role.SUPER_ADMIN, Role.ADMIN],
                },
            },
        });

        if (isAdminExist) {
            console.log("Super Admin already exists. Skipping seeding admin.");
            return;
        }

        const adminUser = await auth.api.signUpEmail({
            body: {
                email: envVars.ADMIN_EMAIL,
                password: envVars.ADMIN_PASSWORD,
                name: "Super Admin",
                role: Role.SUPER_ADMIN,
                needPasswordChange: false,
                rememberMe: false,
            },
        });

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: {
                    id: adminUser.user.id,
                },
                data: {
                    emailVerified: true,
                },
            });

            await tx.admin.create({
                data: {
                    userId: adminUser.user.id,
                    name: "Super Admin",
                    email: envVars.ADMIN_EMAIL,
                },
            });
        });

        const admin = await prisma.admin.findFirst({
            where: {
                email: envVars.ADMIN_EMAIL,
            },
            include: {
                user: true,
            },
        });

        console.log("Super Admin Created:", admin?.email);
    } catch (error) {
        console.error("Error seeding admin: ", error);
        await prisma.user.deleteMany({
            where: {
                email: envVars.ADMIN_EMAIL,
            },
        });
    }
};

