"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { useSpatialAudioContext } from "@/lib/livekit/SpatialAudioContext";

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Lives inside the R3F Canvas and syncs the active camera position to the
 * Web Audio API listener for spatial audio. Place near the top of your scene
 * alongside other system components (OrbitControls, lighting, etc).
 */
export function SpatialAudioBridge() {
  const { setListenerPosition, setListenerOrientation, isReady } =
    useSpatialAudioContext();
  const camera = useThree((s) => s.camera);

  const forward = new Vector3();
  const up = new Vector3();

  useFrame(() => {
    if (!isReady) return;

    // Update listener position from camera world position
    setListenerPosition({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    });

    // Update listener orientation from camera look direction
    camera.getWorldDirection(forward);
    up.set(0, 1, 0);

    setListenerOrientation(
      { x: forward.x, y: forward.y, z: forward.z },
      { x: up.x, y: up.y, z: up.z }
    );
  });

  return null; // No visual output
}
