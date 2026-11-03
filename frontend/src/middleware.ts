import { NextResponse } from "next/server";

/**
 * The refresh-token cookie is issued by the API host. In production the API runs on Render and
 * the UI on Vercel, so that cookie is not visible to this middleware. Redirecting protected
 * routes based on cookie presence sends every signed-in user back to /login.
 *
 * Real authorisation is enforced by the API on every request, and role-based screens are guarded
 * client-side with useRequireRole(). This middleware is intentionally a pass-through.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/admin/:path*", "/landlord/:path*",
    "/applications/:path*", "/leases/:path*", "/maintenance/:path*",
  ],
};
