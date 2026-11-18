import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import {
    changePasswordZodSchema,
    forgetPasswordZodSchema,
    loginUserZodSchema,
    registerUserZodSchema,
    requestEmailOtpZodSchema,
    resetPasswordZodSchema,
    verifyEmailZodSchema,
} from "./auth.validation";

const router = Router();

// Public Authentication
router.post("/register", validateRequest(registerUserZodSchema), AuthController.registerUser);
router.post("/login", validateRequest(loginUserZodSchema), AuthController.loginUser);

// Password Management (Always PUT for update)
router.put("/change-password", checkAuth(), validateRequest(changePasswordZodSchema), AuthController.changePassword);
router.post("/change-password", checkAuth(), validateRequest(changePasswordZodSchema), AuthController.changePassword); // alias for backwards compatibility

// User Profile & Session
router.get("/me", checkAuth(), AuthController.getMe);
router.post("/logout", checkAuth(), AuthController.logoutUser);

// Email Verification & Password Recovery
router.post("/request-email-otp", validateRequest(requestEmailOtpZodSchema), AuthController.requestEmailOTP);
router.post("/verify-email", validateRequest(verifyEmailZodSchema), AuthController.verifyEmail);
router.post("/forget-password", validateRequest(forgetPasswordZodSchema), AuthController.forgetPassword);
router.post("/reset-password", validateRequest(resetPasswordZodSchema), AuthController.resetPassword);

// Google OAuth
router.get("/login/google", AuthController.googleLogin);
router.get("/google/success", AuthController.googleLoginSuccess);
router.get("/oauth/error", AuthController.handleOAuthError);

export const AuthRoutes = router;
