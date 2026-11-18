import { z } from "zod";

export const createStaffZodSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be at most 50 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters").max(32, "Password must be at most 32 characters"),
    role: z.enum(["ADMIN", "MANAGER", "MODERATOR", "INVENTORY_STAFF", "ACCOUNTANT"]),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional(),
    designation: z.string().optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
});

export const updateStaffZodSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be at most 50 characters").optional(),
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional(),
    role: z.enum(["ADMIN", "MANAGER", "MODERATOR", "INVENTORY_STAFF", "ACCOUNTANT"]).optional(),
    status: z.enum(["ACTIVE", "BLOCKED", "DELETED"]).optional(),
    designation: z.string().optional(),
    permissions: z.record(z.string(), z.boolean()).optional(),
});

export const blacklistZodSchema = z.object({
    phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
    reason: z.string().min(3, "Reason must be at least 3 characters"),
    riskLevel: z.enum(["SAFE", "MEDIUM_RISK", "HIGH_RISK"]).optional(),
});
