"use client";

/**
 * Cinematic effects settings.
 *
 * Controls the post-processing pipeline rendered on top of the retro office
 * scene. Persisted in localStorage so it survives reloads.
 *
 * Quality levels:
 *  - "off"        : No post-processing. Raw scene render. Lowest GPU cost.
 *  - "perf"       : SMAA + ToneMapping only. ~free, looks crisp.
 *  - "balanced"   : Adds Bloom + Vignette + soft ChromaticAberration + Noise.
 *                   Default.
 *  - "cinematic"  : Adds DepthOfField, BrightnessContrast, HueSaturation
 *                   tuned for an "epic film" feel. Heavier; intended for
 *                   gaming-grade GPUs and screenshot moments.
 */

import { useCallback, useSyncExternalStore } from "react";

export type CinematicQuality = "off" | "perf" | "balanced" | "cinematic";

export const CINEMATIC_QUALITIES: CinematicQuality[] = [
  "off",
  "perf",
  "balanced",
  "cinematic",
];

const STORAGE_KEY = "claw3d.cinematic.quality";

function isCinematicQuality(value: unknown): value is CinematicQuality {
  return (
    typeof value === "string" &&
    (CINEMATIC_QUALITIES as string[]).includes(value)
  );
}

function readFromStorage(): CinematicQuality | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isCinematicQuality(raw) ? raw : null;
  } catch {
    // localStorage may throw in private mode / sandboxed iframes
    return null;
  }
}

function buildTimeDefault(): CinematicQuality {
  const envDefault = process.env.NEXT_PUBLIC_CINEMATIC_DEFAULT;
  return isCinematicQuality(envDefault) ? envDefault : "balanced";
}

function getSnapshot(): CinematicQuality {
  return readFromStorage() ?? buildTimeDefault();
}

function getServerSnapshot(): CinematicQuality {
  return buildTimeDefault();
}

const STORAGE_EVENT = "storage";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Cross-tab updates fire native "storage" events; same-tab updates fire
  // a custom event we dispatch from `writeQuality`.
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener(STORAGE_EVENT + "::cinematic-local", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener(
      STORAGE_EVENT + "::cinematic-local",
      callback,
    );
  };
}

function writeQuality(q: CinematicQuality): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, q);
      // Notify same-tab subscribers (the native "storage" event only fires
      // in *other* tabs).
      window.dispatchEvent(new Event(STORAGE_EVENT + "::cinematic-local"));
    }
  } catch {
    // ignore quota / privacy errors
  }
}

export function useCinematicQuality(): {
  quality: CinematicQuality;
  setQuality: (q: CinematicQuality) => void;
  cycleQuality: () => void;
} {
  const quality = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setQuality = useCallback((q: CinematicQuality) => {
    writeQuality(q);
  }, []);

  const cycleQuality = useCallback(() => {
    const current = getSnapshot();
    const idx = CINEMATIC_QUALITIES.indexOf(current);
    const next = CINEMATIC_QUALITIES[(idx + 1) % CINEMATIC_QUALITIES.length];
    writeQuality(next);
  }, []);

  return { quality, setQuality, cycleQuality };
}

export function describeQuality(q: CinematicQuality): string {
  switch (q) {
    case "off":
      return "raw scene, no post-fx";
    case "perf":
      return "SMAA + tone-mapping";
    case "balanced":
      return "+ bloom, vignette, grain";
    case "cinematic":
      return "+ depth-of-field, color grade";
  }
}
