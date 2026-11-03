"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const GOLD = 0xc9972b;
const BLUE = 0x2455eb;
const INK = 0x0b1220;

interface BlueprintSceneProps {
  /** "hero" is bigger and busier (landing page); "ambient" is quieter (auth panels). */
  variant?: "hero" | "ambient";
  className?: string;
}

export function BlueprintScene({ variant = "hero", className = "" }: BlueprintSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, variant === "hero" ? 9 : 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Inner wireframe - gold icosahedron "blueprint" of a facet-cut form
    const innerGeom = new THREE.IcosahedronGeometry(variant === "hero" ? 2.4 : 1.9, 0);
    const innerEdges = new THREE.EdgesGeometry(innerGeom);
    const innerLines = new THREE.LineSegments(
      innerEdges,
      new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 })
    );
    group.add(innerLines);

    // Outer wireframe - blue dodecahedron shell, offset rotation
    const outerGeom = new THREE.DodecahedronGeometry(variant === "hero" ? 3.6 : 2.9, 0);
    const outerEdges = new THREE.EdgesGeometry(outerGeom);
    const outerLines = new THREE.LineSegments(
      outerEdges,
      new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: 0.32 })
    );
    outerLines.rotation.set(0.4, 0.3, 0);
    group.add(outerLines);

    // Faint ink core for depth
    const coreGeom = new THREE.IcosahedronGeometry(variant === "hero" ? 1.3 : 1.0, 0);
    const coreMesh = new THREE.Mesh(
      coreGeom,
      new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.04 })
    );
    group.add(coreMesh);

    // Drifting dust particles
    const particleCount = variant === "hero" ? 260 : 140;
    const positions = new Float32Array(particleCount * 3);
    const radius = variant === "hero" ? 6 : 4.6;
    for (let i = 0; i < particleCount; i++) {
      const r = radius * (0.4 + Math.random() * 0.6);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeom,
      new THREE.PointsMaterial({
        color: GOLD,
        size: 0.045,
        transparent: true,
        opacity: 0.65,
        sizeAttenuation: true,
      })
    );
    scene.add(particles);

    // Re-tint the scene when the theme flips (light <-> dark)
    function applySceneTheme() {
      const dark = document.documentElement.classList.contains("dark");
      (innerLines.material as THREE.LineBasicMaterial).opacity = dark ? 0.8 : 0.55;
      (outerLines.material as THREE.LineBasicMaterial).color.setHex(dark ? 0x6a8fff : BLUE);
      (outerLines.material as THREE.LineBasicMaterial).opacity = dark ? 0.5 : 0.32;
      (coreMesh.material as THREE.MeshBasicMaterial).color.setHex(dark ? 0xe8edf9 : INK);
      (coreMesh.material as THREE.MeshBasicMaterial).opacity = dark ? 0.07 : 0.04;
      (particles.material as THREE.PointsMaterial).opacity = dark ? 0.85 : 0.65;
    }
    applySceneTheme();
    window.addEventListener("themechange", applySceneTheme);

    let width = container.clientWidth;
    let height = container.clientHeight;
    function resize() {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    resize();

    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    function onPointerMove(e: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }
    window.addEventListener("pointermove", onPointerMove);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let frameId = 0;
    let visible = true;
    function onVisibilityChange() {
      visible = document.visibilityState === "visible";
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    function renderStatic() {
      group.rotation.set(0.3, 0.5, 0);
      renderer.render(scene, camera);
    }
    if (prefersReducedMotion) {
      window.addEventListener("themechange", renderStatic);
    }

    function animate() {
      frameId = requestAnimationFrame(animate);
      if (!visible) return;

      pointerX += (targetX - pointerX) * 0.03;
      pointerY += (targetY - pointerY) * 0.03;

      group.rotation.y += 0.0018;
      group.rotation.x = 0.25 + pointerY * 0.15;
      group.rotation.z = pointerX * 0.05;
      particles.rotation.y -= 0.0006;

      renderer.render(scene, camera);
    }

    if (prefersReducedMotion) {
      renderStatic();
    } else {
      animate();
    }

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("themechange", applySceneTheme);
      window.removeEventListener("themechange", renderStatic);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      innerGeom.dispose();
      innerEdges.dispose();
      outerGeom.dispose();
      outerEdges.dispose();
      coreGeom.dispose();
      particleGeom.dispose();
      innerLines.material.dispose();
      outerLines.material.dispose();
      coreMesh.material.dispose();
      particles.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [variant]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
    />
  );
}
