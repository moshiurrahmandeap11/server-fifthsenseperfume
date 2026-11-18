import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, emailOTP, oAuthProxy } from "better-auth/plugins";
import { Role, UserStatus } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { sendEmail } from "../utils/email";
import { prisma } from "./prisma";

export const auth = betterAuth({
    baseURL: envVars.BETTER_AUTH_URL,
    secret: envVars.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    session: {
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        updateAge: 24 * 60 * 60, // 1 day in seconds
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60, // 5 minutes cache to avoid constant database hits
        },
    },

    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },

    socialProviders: {
        google: {
            clientId: envVars.GOOGLE_CLIENT_ID,
            clientSecret: envVars.GOOGLE_CLIENT_SECRET,
            mapProfileToUser: () => {
                return {
                    role: Role.CUSTOMER,
                    status: UserStatus.ACTIVE,
                    needPasswordChange: false,
                    emailVerified: true,
                    isDeleted: false,
                    deletedAt: null,
                };
            },
        },
    },

    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
    },

    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: Role.CUSTOMER,
            },
            status: {
                type: "string",
                required: true,
                defaultValue: UserStatus.ACTIVE,
            },
            needPasswordChange: {
                type: "boolean",
                required: true,
                defaultValue: false,
            },
            birthdate: {
                type: "date",
                required: false,
                defaultValue: null,
            },
            gender: {
                type: "string",
                required: false,
                defaultValue: null,
            },
            phoneNumber: {
                type: "string",
                required: false,
                defaultValue: null,
            },
            address: {
                type: "string",
                required: false,
                defaultValue: null,
            },
            savedShoeSize: {
                type: "string",
                required: false,
                defaultValue: null,
            },
            loyaltyPoints: {
                type: "number",
                required: true,
                defaultValue: 0,
            },
            isDeleted: {
                type: "boolean",
                required: true,
                defaultValue: false,
            },
            deletedAt: {
                type: "date",
                required: false,
                defaultValue: null,
            },
        },
    },

    plugins: [
        bearer(), // Enables Authorization: Bearer <session_token> for APIs
        emailOTP({
            overrideDefaultEmailVerification: true,
            async sendVerificationOTP({ email, otp, type }) {
                if (type === "email-verification") {
                    const user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (!user) {
                        console.error(`User with email ${email} not found. Cannot send verification OTP.`);
                        return;
                    }

                    if (user && (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN)) {
                        console.log(`User with email ${email} is an admin. Skipping sending verification OTP.`);
                        return;
                    }

                    if (user && !user.emailVerified) {
                        try {
                            await sendEmail({
                                to: email,
                                subject: "Verify your email - EcomBD",
                                templateName: "otp",
                                templateData: {
                                    name: user.name,
                                    otp,
                                },
                            });
                            console.log(`Verification OTP sent successfully to ${email}`);
                        } catch (err) {
                            console.error(`Failed to send verification OTP to ${email}:`, err);
                        }
                    }
                } else if (type === "forget-password") {
                    const user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (user) {
                        try {
                            await sendEmail({
                                to: email,
                                subject: "Password Reset OTP - EcomBD",
                                templateName: "otp",
                                templateData: {
                                    name: user.name,
                                    otp,
                                },
                            });
                            console.log(`Password reset OTP sent successfully to ${email}`);
                        } catch (err) {
                            console.error(`Failed to send password reset OTP to ${email}:`, err);
                        }
                    }
                }
            },
            expiresIn: 2 * 60, // 2 minutes in seconds
            otpLength: 6,
        }),
        oAuthProxy(),
    ],

    redirectURLs: {
        signIn: `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success`,
    },

    trustedOrigins: [
        process.env.BETTER_AUTH_URL || "http://localhost:5000",
        envVars.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:4242",
        "http://localhost:8252",
    ],

    advanced: {
        useSecureCookies: false,
        cookies: {
            state: {
                attributes: {
                    sameSite: "none",
                    secure: true,
                    httpOnly: true,
                    path: "/",
                },
            },
            session_token: {
                name: "better-auth.session_token",
                attributes: {
                    sameSite: "none",
                    secure: true,
                    httpOnly: true,
                    path: "/",
                },
            },
        },
    },
});
