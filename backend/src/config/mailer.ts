import nodemailer from "nodemailer";
import { env } from "./env";

export const mailerConfigured = Boolean(env.smtpHost && env.smtpUser && env.smtpPass);

export const transporter = mailerConfigured
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    })
  : null;

export const emailFrom = env.emailFrom;

if (!mailerConfigured) {
  console.warn(
    "⚠️  Email is not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASS). Notification emails will be logged, not sent."
  );
}