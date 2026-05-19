"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface SpatialAudioContextValue {
  audioContext: AudioContext | null;
  isReady: boolean;
  playAtPosition: (buffer: AudioBuffer, position: Vec3) => Promise<void>;
  setListenerPosition: (position: Vec3) => void;
  setListenerOrientation: (forward: Vec3, up: Vec3) => void;
}

type LegacyAudioListener = AudioListener & {
  setPosition?: (x: number, y: number, z: number) => void;
  setOrientation?: (
    forwardX: number,
    forwardY: number,
    forwardZ: number,
    upX: number,
    upY: number,
    upZ: number,
  ) => void;
};

// ── Context ──────────────────────────────────────────────────────────────────

const SpatialAudioCtx = createContext<SpatialAudioContextValue | null>(null);

export function useSpatialAudioContext(): SpatialAudioContextValue {
  const ctx = useContext(SpatialAudioCtx);
  if (!ctx) {
    throw new Error("useSpatialAudioContext must be used within a SpatialAudioProvider");
  }
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function SpatialAudioProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<SpatialAudioContextValue>(() => {
    try {
      const ac = new AudioContext();
      return {
        audioContext: ac,
        isReady: ac.state === "running",
        playAtPosition: async () => {},
        setListenerPosition: () => {},
        setListenerOrientation: () => {},
      };
    } catch {
      return {
        audioContext: null,
        isReady: false,
        playAtPosition: async () => {},
        setListenerPosition: () => {},
        setListenerOrientation: () => {},
      };
    }
  });

  useEffect(() => {
    const ac = ctx.audioContext;
    if (!ac) return;

    const resumeOnInteraction = () => {
      if (ac.state === "suspended") void ac.resume();
      setCtx((prev) => (prev?.isReady ? prev : { ...prev, isReady: ac.state === "running" }));
    };

    window.addEventListener("pointerdown", resumeOnInteraction, { once: true });
    window.addEventListener("keydown", resumeOnInteraction, { once: true });

    // ── playAtPosition with HRTF panner ──────────────────────────────────
    const playAtPosition = async (buffer: AudioBuffer, position: Vec3) => {
      if (ac.state === "suspended") await ac.resume();
      setCtx((prev) => ({ ...prev, isReady: true }));

      const source = ac.createBufferSource();
      source.buffer = buffer;

      const panner = ac.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 1;
      panner.maxDistance = 50;
      panner.rolloffFactor = 1;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;

      source.connect(panner);
      panner.connect(ac.destination);
      source.start();

      return new Promise<void>((resolve) => {
        source.onended = () => {
          source.disconnect();
          panner.disconnect();
          resolve();
        };
      });
    };

    // ── setListenerPosition ─────────────────────────────────────────────
    const setListenerPosition = (position: Vec3) => {
      if ("positionX" in ac.listener) {
        ac.listener.positionX.value = position.x;
        ac.listener.positionY.value = position.y;
        ac.listener.positionZ.value = position.z;
      } else {
        // Firefox fallback
        (ac.listener as LegacyAudioListener).setPosition?.(position.x, position.y, position.z);
      }
    };

    // ── setListenerOrientation ───────────────────────────────────────────
    const setListenerOrientation = (forward: Vec3, up: Vec3) => {
      if ("forwardX" in ac.listener) {
        ac.listener.forwardX.value = forward.x;
        ac.listener.forwardY.value = forward.y;
        ac.listener.forwardZ.value = forward.z;
        ac.listener.upX.value = up.x;
        ac.listener.upY.value = up.y;
        ac.listener.upZ.value = up.z;
      } else {
        (ac.listener as LegacyAudioListener).setOrientation?.(
          forward.x, forward.y, forward.z,
          up.x, up.y, up.z
        );
      }
    };

    queueMicrotask(() => {
      setCtx((prev) => ({
        ...prev,
        isReady: ac.state === "running",
        playAtPosition,
        setListenerPosition,
        setListenerOrientation,
      }));
    });

    return () => {
      window.removeEventListener("pointerdown", resumeOnInteraction);
      window.removeEventListener("keydown", resumeOnInteraction);
      void ac.close();
    };
  }, [ctx.audioContext !== null]);

  return (
    <SpatialAudioCtx.Provider value={ctx}>
      {children}
    </SpatialAudioCtx.Provider>
  );
}
