import { FraudRiskLevel, Role, UserStatus } from "../../../generated/prisma/enums";

export interface ICreateStaffPayload {
    name: string;
    email: string;
    password: string;
    role: Role;
    phoneNumber?: string;
    profilePhoto?: string;
}

export interface IUpdateStaffPayload {
    name?: string;
    phoneNumber?: string;
    profilePhoto?: string;
    role?: Role;
    status?: UserStatus;
}

export interface IBlacklistPayload {
    phoneNumber: string;
    reason: string;
    riskLevel?: FraudRiskLevel;
}
