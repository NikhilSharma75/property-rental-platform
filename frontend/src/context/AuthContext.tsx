"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, setAccessToken, type PublicUser } from "@/lib/api";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  register: (params: {
    fullName: string;
    email: string;
    password: string;
    role: "TENANT" | "LANDLORD";
    phone?: string;
  }, redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<PublicUser>) => void;
}

/** Only same-site absolute paths are accepted, so ?redirectTo=https://evil.com can't be used as an open redirect. */
function safeRedirect(target: string | null | undefined, fallback: string): string {
  if (target && target.startsWith("/") && !target.startsWith("//")) return target;
  return fallback;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On first load, silently try to restore the session using the httpOnly cookie.
  useEffect(() => {
    (async () => {
      try {
        const { user, accessToken } = await api.refresh();
        setAccessToken(accessToken);
        setUser(user);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string, redirectTo?: string) {
    const { user, accessToken } = await api.login({ email, password });
    setAccessToken(accessToken);
    setUser(user);
    router.push(safeRedirect(redirectTo, user.role === "ADMIN" ? "/admin" : "/dashboard"));
  }

  async function register(params: {
    fullName: string;
    email: string;
    password: string;
    role: "TENANT" | "LANDLORD";
    phone?: string;
  }, redirectTo?: string) {
    const { user, accessToken } = await api.register(params);
    setAccessToken(accessToken);
    setUser(user);
    router.push(safeRedirect(redirectTo, "/dashboard"));
  }

  async function logout() {
    await api.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
    router.push("/login");
  }

  // Lets pages (like the profile screen) reflect saved changes - name, phone,
  // avatar - in the header/nav immediately, without a full session refetch.
  function updateUser(patch: Partial<PublicUser>) {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }

  return createElement(
    AuthContext.Provider,
    { value: { user, loading, login, register, logout, updateUser } },
    children,
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}