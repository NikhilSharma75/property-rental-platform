"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type Role = "TENANT" | "LANDLORD" | "ADMIN";

/** Client-side route guard. Real enforcement is the API's job - this only keeps the wrong UI off-screen. */
export function useRequireRole(roles: Role[]) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!roles.includes(user.role)) router.replace(user.role === "ADMIN" ? "/admin" : "/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, router]);

  return { user, logout, ready: !loading && allowed };
}
