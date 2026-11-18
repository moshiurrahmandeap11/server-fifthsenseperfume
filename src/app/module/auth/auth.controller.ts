/* eslint-disable @typescript-eslint/no-explicit-any */
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response } from "express";
import status from "http-status";
import { envVars } from "../../config/env";
import { auth } from "../../lib/auth";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CookieUtils } from "../../utils/cookie";
import { AuthService } from "./auth.service";

const registerUser = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const result = await AuthService.registerUser(payload);

    if (result.token) {
        CookieUtils.setSessionCookie(res, result.token);
    }

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "User registered successfully",
        data: result,
    });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const result = await AuthService.loginUser(payload);

    if (result.token) {
        CookieUtils.setSessionCookie(res, result.token);
    }

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User logged in successfully",
        data: result,
    });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const result = await AuthService.getMe(user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User profile fetched successfully",
        data: result,
    });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
    const payload = req.body;
    const headers = fromNodeHeaders(req.headers);

    const result = await AuthService.changePassword(payload, headers);

    if (result?.token) {
        CookieUtils.setSessionCookie(res, result.token);
    }

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Password changed successfully",
        data: result,
    });
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
    const headers = fromNodeHeaders(req.headers);
    const result = await AuthService.logoutUser(headers);

    CookieUtils.clearSessionCookie(res);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User logged out successfully",
        data: result,
    });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await AuthService.verifyEmail(email, otp);

    if (result?.token) {
        CookieUtils.setSessionCookie(res, result.token);
    }

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Email verified successfully",
        data: result,
    });
});

const requestEmailOTP = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;
    await AuthService.requestEmailOTP(email);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "OTP sent successfully to email",
    });
});

const forgetPassword = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;
    await AuthService.forgetPassword(email);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Password reset OTP sent to email successfully",
    });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;
    await AuthService.resetPassword(email, otp, newPassword);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Password reset successfully",
    });
});

const googleLogin = catchAsync((req: Request, res: Response) => {
    const redirectPath = req.query.redirect || "/account";
    const encodedRedirectPath = encodeURIComponent(redirectPath as string);
    const callbackURL = `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;

    res.render("googleRedirect", {
        callbackURL,
        betterAuthUrl: envVars.BETTER_AUTH_URL,
    });
});

const googleLoginSuccess = catchAsync(async (req: Request, res: Response) => {
    const redirectPath = (req.query.redirect as string) || "/account";

    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_session_found`);
    }

    const sessionToken = session.session.token;
    CookieUtils.setSessionCookie(res, sessionToken);

    const isValidRedirectPath = redirectPath.startsWith("/") && !redirectPath.startsWith("//");
    const finalRedirectPath = isValidRedirectPath ? redirectPath : "/account";

    const callbackURL = `${envVars.FRONTEND_URL}/login/callback?sessionToken=${sessionToken}&redirect=${encodeURIComponent(finalRedirectPath)}`;

    res.redirect(callbackURL);
});

const handleOAuthError = catchAsync((req: Request, res: Response) => {
    const error = (req.query.error as string) || "oauth_failed";
    res.redirect(`${envVars.FRONTEND_URL}/login?error=${error}`);
});

export const AuthController = {
    registerUser,
    loginUser,
    getMe,
    changePassword,
    logoutUser,
    verifyEmail,
    requestEmailOTP,
    forgetPassword,
    resetPassword,
    googleLogin,
    googleLoginSuccess,
    handleOAuthError,
};
