"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// three.js is ~600 KB: load it only on the client, after first paint, and never for reduced-motion users.
const BlueprintScene = dynamic(
  () => import("@/components/three/BlueprintScene").then((m) => m.BlueprintScene),
  { ssr: false },
);

export function HeroScene() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    if (reduce || narrow) return;
    const t = window.setTimeout(() => setEnabled(true), 400);
    return () => window.clearTimeout(t);
  }, []);
  return enabled ? <BlueprintScene variant="hero" /> : null;
}
