"use client";

import { useSpatialAudioContext } from "@/lib/livekit/SpatialAudioContext";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SpatialAudioState {
  audioContext: AudioContext | null;
  isReady: boolean;
  playAtPosition: (buffer: AudioBuffer, position: Vec3) => Promise<void>;
  setListenerPosition: (position: Vec3) => void;
  setListenerOrientation: (forward: Vec3, up: Vec3) => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Thin wrapper around SpatialAudioContext for backward compatibility.
 * Prefer using useSpatialAudioContext() directly in new code.
 */
export function useSpatialAudio(): SpatialAudioState {
  return useSpatialAudioContext();
}
