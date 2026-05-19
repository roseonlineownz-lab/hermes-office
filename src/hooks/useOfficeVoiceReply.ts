"use client";

import { useCallback, useEffect, useRef } from "react";
import { useVoiceReplyPlayback } from "@/hooks/useVoiceReplyPlayback";
import { useSpatialAudio } from "@/hooks/useSpatialAudio";
import type { VoiceReplyProvider } from "@/lib/voiceReply/provider";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OfficeVoiceReplyRequest {
  text: string;
  /** Agent ID to play the voice reply at its 3D position */
  agentId?: string | null;
  provider?: VoiceReplyProvider;
  voiceId?: string | null;
  speed?: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Voice reply with 3D spatial audio positioning.
 *
 * Wraps `useVoiceReplyPlayback` with `useSpatialAudio` so that when
 * `agentId` and a valid `getAgentPosition` callback are provided,
 * the agent voice is panned to the 3D world position using HRTF.
 *
 * The consumer must call `setListenerPosition` and `setListenerOrientation`
 * each frame from the 3D camera position for spatial audio to work.
 */
export function useOfficeVoiceReply(params: {
  enabled: boolean;
  provider?: VoiceReplyProvider;
  voiceId?: string | null;
  speed?: number;
  onProviderFallback?: (provider: VoiceReplyProvider) => void;
  /** Resolve an agent ID to its current 3D world position */
  getAgentPosition?: (agentId: string) => Vec3 | null;
}) {
  const {
    enabled,
    provider,
    voiceId,
    speed,
    onProviderFallback,
    getAgentPosition,
  } = params;

  const {
    playAtPosition,
    setListenerPosition,
    setListenerOrientation,
    audioContext: spatialCtx,
  } = useSpatialAudio();

  // Keep getAgentPosition in a ref so onPlayAudio always sees latest
  const getAgentPositionRef = useRef(getAgentPosition);
  useEffect(() => {
    getAgentPositionRef.current = getAgentPosition;
  }, [getAgentPosition]);

  // Queue tracking: map generation -> agentId for safe correlation.
  const nextGenRef = useRef(0);
  const agentIdMapRef = useRef<Map<number, string | null>>(new Map());

  // ── onPlayAudio callback (spatial, then fallback to shared context) ────────

  const onPlayAudio = useCallback(
    async (buffer: AudioBuffer) => {
      // Consume the oldest generation-to-agentId mapping (FIFO)
      let agentId: string | null = null;
      const map = agentIdMapRef.current;
      if (map.size > 0) {
        const keys = Array.from(map.keys()).sort((a, b) => a - b);
        const oldestKey = keys[0];
        agentId = map.get(oldestKey) ?? null;
        map.delete(oldestKey);
      }

      if (agentId && getAgentPositionRef.current) {
        const pos = getAgentPositionRef.current(agentId);
        if (pos) {
          await playAtPosition(buffer, pos);
          return;
        }
      }

      // Fallback: play without spatial positioning using shared AudioContext
      if (spatialCtx) {
        if (spatialCtx.state === "suspended") {
          await spatialCtx.resume();
        }
        const source = spatialCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(spatialCtx.destination);
        source.start();
        await new Promise<void>((resolve) => {
          source.onended = () => {
            source.disconnect();
            resolve();
          };
        });
      }
    },
    [playAtPosition, spatialCtx],
  );

  // ── Base playback hook ─────────────────────────────────────────────────────

  const playback = useVoiceReplyPlayback({
    enabled,
    provider,
    voiceId,
    speed,
    onProviderFallback,
    onPlayAudio,
  });

  // ── Public API ─────────────────────────────────────────────────────────────

  const enqueueSpatial = useCallback(
    (request: OfficeVoiceReplyRequest) => {
      const gen = nextGenRef.current++;
      agentIdMapRef.current.set(gen, request.agentId ?? null);
      playback.enqueue({
        text: request.text,
        provider: request.provider,
        voiceId: request.voiceId,
        speed: request.speed,
      });
    },
    [playback],
  );

  const previewSpatial = useCallback(
    async (request: OfficeVoiceReplyRequest) => {
      const gen = nextGenRef.current++;
      agentIdMapRef.current.set(gen, request.agentId ?? null);
      await playback.preview({
        text: request.text,
        provider: request.provider,
        voiceId: request.voiceId,
        speed: request.speed,
      });
    },
    [playback],
  );

  return {
    enqueue: enqueueSpatial,
    preview: previewSpatial,
    stop: playback.stop,
    playing: playback.playing,
    /** Update the audio listener position (call each frame from camera position) */
    setListenerPosition,
    /** Update the audio listener orientation (call each frame from camera forward/up) */
    setListenerOrientation,
  };
}
