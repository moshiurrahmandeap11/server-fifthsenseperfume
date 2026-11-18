import { z } from "zod";

export const registerUserZodSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be at most 50 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters").max(32, "Password must be at most 32 characters"),
    birthdate: z.string().datetime({ message: "Invalid birthdate format (ISO string expected)" }).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional(),
    address: z.string().optional(),
    savedShoeSize: z.string().optional(),
});

export const loginUserZodSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const changePasswordZodSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters").max(32, "Password must be at most 32 characters"),
});

export const verifyEmailZodSchema = z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
});

export const requestEmailOtpZodSchema = z.object({
    email: z.string().email("Invalid email address"),
});

export const forgetPasswordZodSchema = z.object({
    email: z.string().email("Invalid email address"),
});

export const resetPasswordZodSchema = z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
    newPassword: z.string().min(6, "New password must be at least 6 characters").max(32, "Password must be at most 32 characters"),
});
