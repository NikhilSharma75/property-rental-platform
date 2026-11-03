"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { favoriteApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function FavoriteButton({
  propertyId,
  initialFavorited,
  className = "",
  onChange,
}: {
  propertyId: string;
  initialFavorited: boolean;
  className?: string;
  /** Called after the server confirms a change (e.g. so the Favorites page can drop the card). */
  onChange?: (favorited: boolean) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  // Only tenants can save listings; the API rejects everyone else.
  if (user && user.role !== "TENANT") return null;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (loading) return;
    setLoading(true);
    const next = !favorited;
    setFavorited(next); // optimistic
    try {
      if (next) await favoriteApi.add(propertyId);
      else await favoriteApi.remove(propertyId);
      onChange?.(next);
    } catch {
      setFavorited(!next); // revert on failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={`h-9 w-9 rounded-full bg-surface/95 shadow flex items-center justify-center transition-transform active:scale-90 ${className}`}
    >
      <Heart className={`h-4 w-4 transition-colors ${favorited ? "fill-gold text-gold" : "text-ink/50"}`} />
    </button>
  );
}
