"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveKit } from "@/lib/livekit/LiveKitContext";
import { useSpatialAudioContext } from "@/lib/livekit/SpatialAudioContext";
import type { RemoteAudioTrackInfo } from "@/lib/livekit/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

type AgentPositionResolver = (agentId: string) => Vec3 | null;

interface ActiveSpatialTrack {
  sourceNode: MediaStreamAudioSourceNode;
  pannerNode: PannerNode;
  agentId: string;
  participantIdentity: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Bridges LiveKit remote audio tracks into the spatial audio system.
 *
 * When a remote participant publishes an audio track with agent metadata,
 * this hook creates a PannerNode positioned at the agent's 3D location
 * and routes the audio through it.
 */
export function useLiveKitAudioBridge(
  getAgentPosition: AgentPositionResolver,
) {
  const { remoteAudioTracks } = useLiveKit();
  const { audioContext, isReady } = useSpatialAudioContext();

  const activeTracksRef = useRef<Map<string, ActiveSpatialTrack>>(new Map());
  const getAgentPositionRef = useRef(getAgentPosition);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    getAgentPositionRef.current = getAgentPosition;
  }, [getAgentPosition]);

  // Create spatial audio pipeline for new remote tracks
  useEffect(() => {
    if (!isReady || !audioContext) return;

    const activeTracks = activeTracksRef.current;

    remoteAudioTracks.forEach((info: RemoteAudioTrackInfo) => {
      const key = info.participantIdentity;

      // Skip if already active
      if (activeTracks.has(key)) return;

      // Skip if no agentId mapping
      const agentId = info.agentId;
      if (!agentId) return;

      try {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(info.track.mediaStreamTrack);

        const sourceNode =
          audioContext.createMediaStreamSource(mediaStream);
        const pannerNode = audioContext.createPanner();
        pannerNode.panningModel = "HRTF";
        pannerNode.distanceModel = "inverse";
        pannerNode.refDistance = 1;
        pannerNode.maxDistance = 50;
        pannerNode.rolloffFactor = 1;

        // Set initial position based on agent
        const pos = getAgentPositionRef.current(agentId);
        if (pos) {
          pannerNode.positionX.value = pos.x;
          pannerNode.positionY.value = pos.y;
          pannerNode.positionZ.value = pos.z;
        }

        sourceNode.connect(pannerNode);
        pannerNode.connect(audioContext.destination);

        activeTracks.set(key, {
          sourceNode,
          pannerNode,
          agentId,
          participantIdentity: key,
        });
      } catch (err) {
        console.warn(
          "Failed to create spatial audio for track " + key + ":",
          err,
        );
      }
    });

    // Clean up tracks that are no longer in remoteAudioTracks
    activeTracks.forEach((track, key) => {
      if (!remoteAudioTracks.has(key)) {
        try {
          track.sourceNode.disconnect();
          track.pannerNode.disconnect();
        } catch { /* ignore */ }
        activeTracks.delete(key);
      }
    });
    setActiveCount(activeTracks.size);
  }, [remoteAudioTracks, isReady, audioContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeTracksRef.current.forEach((track) => {
        try {
          track.sourceNode.disconnect();
          track.pannerNode.disconnect();
        } catch { /* ignore */ }
      });
      activeTracksRef.current.clear();
      setActiveCount(0);
    };
  }, []);

  // Return a function to update panner positions (called from 3D scene)
  return {
    /**
     * Update panner positions for all active spatial tracks.
     * Call this from the R3F render loop (useFrame) with fresh agent positions.
     */
    updatePannerPositions: () => {
      const activeTracks = activeTracksRef.current;
      activeTracks.forEach((track) => {
        const pos = getAgentPositionRef.current(track.agentId);
        if (pos) {
          track.pannerNode.positionX.value = pos.x;
          track.pannerNode.positionY.value = pos.y;
          track.pannerNode.positionZ.value = pos.z;
        }
      });
    },
    /** Number of active spatial audio tracks */
    activeCount,
  };
}
