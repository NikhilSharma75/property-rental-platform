import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service";
import { env } from "../config/env";

const REFRESH_COOKIE = "refreshToken";

const cookieOptions: {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "none" | "lax";
  path: string;
} = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
  path: "/",
};



const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["TENANT", "LANDLORD"]), // admins are never created via public signup
  phone: z.string().optional(),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.registerUser(body);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.loginUser(email, password);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.status(200).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({ message: "No refresh token provided." });
    }

    const { user, accessToken, refreshToken } = await authService.rotateRefreshToken(token);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.status(200).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await authService.logoutUser(token);
    }
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    res.status(200).json({ message: "Logged out." });
  } catch (err) {
    next(err);
  }
}

const forgotSchema = z.object({ email: z.string().email() });

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = forgotSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.status(200).json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
}

const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, newPassword } = resetSchema.parse(req.body);
    await authService.resetPassword(token, newPassword);
    res.status(200).json({ message: "Password updated. Please log in again." });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response) {
  res.status(200).json({ user: req.user });
}