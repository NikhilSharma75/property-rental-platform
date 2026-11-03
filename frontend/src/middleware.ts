import { NextRequest, NextResponse } from "next/server";

// Lightweight edge check: does a refreshToken cookie exist at all?
// Real authorisation (valid token? right role?) is enforced by the API on every request;
// role-based screens are additionally guarded client-side with useRequireRole().
const PROTECTED_PREFIXES = [
  "/dashboard", "/admin", "/landlord", "/applications", "/leases", "/maintenance",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  if (!req.cookies.has("refreshToken")) {
    const loginUrl = new URL("/login", req.url);
    // only same-site relative paths are ever used as redirect targets
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/admin/:path*", "/landlord/:path*",
    "/applications/:path*", "/leases/:path*", "/maintenance/:path*",
  ],
};
