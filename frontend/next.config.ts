import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
const SOCKET = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5000";
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const origin = (u: string) => { try { return new URL(u).origin; } catch { return ""; } };

// Report-Only first: watch the browser console / a report endpoint for violations, then switch the
// header name to "Content-Security-Policy" once clean. 'unsafe-inline' scripts are needed today for the
// theme bootstrap + Next inline chunks; move to nonces (middleware) to drop it.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${origin(SUPABASE)}`,
  "font-src 'self' data:",
  `connect-src 'self' ${origin(API)} ${origin(SOCKET)} ${SOCKET.replace(/^http/, "ws")} ${origin(SUPABASE)}`,
  "frame-src https://checkout.stripe.com https://api.razorpay.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // lets us migrate <img> to next/image with resizing + CDN caching
    remotePatterns: SUPABASE ? [{ protocol: "https", hostname: new URL(SUPABASE).hostname }] : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
