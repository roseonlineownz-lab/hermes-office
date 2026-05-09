"use client";

/**
 * Post-processing pipeline for the retro office scene.
 *
 * Renders inside the existing R3F <Canvas /> as a sibling to scene content.
 * Uses @react-three/postprocessing's <EffectComposer> with effects gated by
 * the user-selected quality level (see ./cinematicSettings).
 *
 * The component is intentionally resilient to hostile environments:
 *  - returns null when quality === "off"
 *  - never assumes WebGL2 features that the underlying postprocessing lib
 *    cannot polyfill
 *  - keys the composer on quality so React tears down + remounts effects
 *    when the user toggles quality. This avoids stale uniform state.
 *
 * A future PR will add selection-based Bloom and Outline (so only emissive
 * surfaces / focused agents glow) and a GodRays sun pass when an outdoor
 * environment is active.
 */

import { useMemo } from "react";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
  DepthOfField,
  HueSaturation,
  BrightnessContrast,
  SMAA,
  ToneMapping,
} from "@react-three/postprocessing";
import {
  BlendFunction,
  KernelSize,
  Resolution,
  ToneMappingMode,
} from "postprocessing";
import * as THREE from "three";
import type { CinematicQuality } from "./cinematicSettings";

type Props = {
  quality: CinematicQuality;
};

/**
 * Map quality level to a simple feature flag bag so the JSX below stays
 * declarative. Tweak these to retune the look without reshuffling the tree.
 */
function flagsForQuality(quality: CinematicQuality) {
  switch (quality) {
    case "off":
      return null;
    case "perf":
      return {
        smaa: true,
        toneMapping: true,
        bloom: false,
        vignette: false,
        chromaticAberration: false,
        noise: false,
        depthOfField: false,
        colorGrade: false,
      };
    case "balanced":
      return {
        smaa: true,
        toneMapping: true,
        bloom: true,
        vignette: true,
        chromaticAberration: true,
        noise: true,
        depthOfField: false,
        colorGrade: false,
      };
    case "cinematic":
      return {
        smaa: true,
        toneMapping: true,
        bloom: true,
        vignette: true,
        chromaticAberration: true,
        noise: true,
        depthOfField: true,
        colorGrade: true,
      };
  }
}

export function CinematicEffects({ quality }: Props) {
  const flags = useMemo(() => flagsForQuality(quality), [quality]);

  if (!flags) return null;

  return (
    <EffectComposer
      key={quality}
      multisampling={0}
      enableNormalPass={false}
      stencilBuffer={false}
      autoClear={false}
      resolutionScale={1}
    >
      {/* Tone-mapping first so subsequent effects work in linear space. */}
      {flags.toneMapping ? (
        <ToneMapping
          mode={ToneMappingMode.ACES_FILMIC}
          adaptive={false}
          resolution={256}
          middleGrey={0.6}
          maxLuminance={16.0}
          averageLuminance={1.0}
          adaptationRate={1.0}
        />
      ) : (
        <></>
      )}

      {/*
        Bloom: a wide, soft glow on the brightest pixels. luminanceThreshold
        is high so only emissive materials (jukebox neon, monitor screens,
        the orb) actually bloom — ambient lit surfaces stay clean.
      */}
      {flags.bloom ? (
        <Bloom
          intensity={0.65}
          luminanceThreshold={0.82}
          luminanceSmoothing={0.18}
          mipmapBlur
          kernelSize={KernelSize.LARGE}
          resolutionX={Resolution.AUTO_SIZE}
          resolutionY={Resolution.AUTO_SIZE}
        />
      ) : (
        <></>
      )}

      {/*
        DOF: only at "cinematic" because it samples depth aggressively. The
        focusDistance is tuned for the default isometric camera (CAM_POS in
        RetroOffice3D). World coordinates are normalized internally.
      */}
      {flags.depthOfField ? (
        <DepthOfField
          focusDistance={0.018}
          focalLength={0.06}
          bokehScale={2.4}
          height={480}
        />
      ) : (
        <></>
      )}

      {flags.colorGrade ? (
        <BrightnessContrast brightness={0.02} contrast={0.08} />
      ) : (
        <></>
      )}

      {flags.colorGrade ? (
        <HueSaturation
          blendFunction={BlendFunction.NORMAL}
          hue={0}
          saturation={0.12}
        />
      ) : (
        <></>
      )}

      {/*
        Subtle radial chromatic aberration — gives the orthographic camera
        a slight CRT vibe without screaming "broken render".
      */}
      {flags.chromaticAberration ? (
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.0008, 0.0008)}
          radialModulation={false}
          modulationOffset={0}
        />
      ) : (
        <></>
      )}

      {/* Soft film grain. Premultiplied so it darkens shadows but doesn't
          wash out highlights. */}
      {flags.noise ? (
        <Noise
          premultiply
          blendFunction={BlendFunction.MULTIPLY}
          opacity={0.18}
        />
      ) : (
        <></>
      )}

      {flags.vignette ? (
        <Vignette eskil={false} offset={0.32} darkness={0.62} />
      ) : (
        <></>
      )}

      {/* SMAA last so anti-aliasing runs after all blends. */}
      {flags.smaa ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
