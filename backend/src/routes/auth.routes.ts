import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { rateLimit } from "../middleware/rateLimit.middleware";
import { requireSameOrigin } from "../middleware/origin.middleware";

const router = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, keyPrefix: "login" });
const signupLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, keyPrefix: "register" });
const resetLimiter = rateLimit({ windowMs: 60 * 60_000, max: 5, keyPrefix: "reset" });
const refreshLimiter = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: "refresh" });

router.post("/register", signupLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh", requireSameOrigin, refreshLimiter, authController.refresh);
router.post("/logout", requireSameOrigin, authController.logout);
router.post("/forgot-password", resetLimiter, authController.forgotPassword);
router.post("/reset-password", resetLimiter, authController.resetPassword);
router.get("/me", requireAuth, authController.me);

export default router;