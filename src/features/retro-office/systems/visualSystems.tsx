"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import * as THREE from "three";
import {
  CANVAS_H,
  CANVAS_W,
  SCALE,
  SNAP_GRID,
} from "@/features/retro-office/core/constants";
import { toWorld } from "@/features/retro-office/core/geometry";
import type {
  OfficeAgent,
  RenderAgent,
} from "@/features/retro-office/core/types";

const HEAT_COLS = Math.floor(CANVAS_W / SNAP_GRID);
const HEAT_ROWS = Math.floor(CANVAS_H / SNAP_GRID);

export function HeatmapSystem({
  agentsRef,
  heatmapMode,
  heatGridRef,
}: {
  agentsRef: RefObject<RenderAgent[]>;
  heatmapMode: boolean;
  heatGridRef: MutableRefObject<Uint16Array | null>;
}) {
  const frameRef = useRef(0);
  const cellsRef = useRef<{ x: number; z: number; v: number }[]>([]);
  const fallbackHeatGridRef = useRef<Uint16Array>(
    new Uint16Array(HEAT_COLS * HEAT_ROWS),
  );
  const [cells, setCells] = useState<{ x: number; z: number; v: number }[]>([]);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    if (heatGridRef.current == null) {
      heatGridRef.current = fallbackHeatGridRef.current;
    }
  }, [heatGridRef]);

  useFrame(() => {
    frameRef.current += 1;
    const grid = heatGridRef.current ?? fallbackHeatGridRef.current;
    if (heatGridRef.current == null) {
      heatGridRef.current = grid;
    }

    if (frameRef.current % (heatmapMode ? 30 : 45) === 0) {
      for (const agent of agentsRef.current ?? []) {
        const col = Math.floor(agent.x / SNAP_GRID);
        const row = Math.floor(agent.y / SNAP_GRID);
        if (col >= 0 && col < HEAT_COLS && row >= 0 && row < HEAT_ROWS) {
          grid[row * HEAT_COLS + col] = Math.min(
            65535,
            grid[row * HEAT_COLS + col] + 1,
          );
        }
      }
    }

    if (heatmapMode && frameRef.current % 120 === 0) {
      let maxValue = 1;
      for (let index = 0; index < grid.length; index += 1) {
        if (grid[index] > maxValue) maxValue = grid[index];
      }

      const nextCells: { x: number; z: number; v: number }[] = [];
      for (let row = 0; row < HEAT_ROWS; row += 1) {
        for (let col = 0; col < HEAT_COLS; col += 1) {
          const value = grid[row * HEAT_COLS + col];
          if (value === 0) continue;
          const [wx, , wz] = toWorld(
            col * SNAP_GRID + SNAP_GRID / 2,
            row * SNAP_GRID + SNAP_GRID / 2,
          );
          nextCells.push({ x: wx, z: wz, v: value / maxValue });
        }
      }

      setCells(nextCells);
    }

    if (!heatmapMode && cellsRef.current.length > 0) {
      setCells([]);
    }
  });

  if (!heatmapMode) return null;

  return (
    <>
      {cells.map((cell, index) => (
        <mesh
          key={index}
          position={[cell.x, 0.002, cell.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[SNAP_GRID * SCALE * 0.9, SNAP_GRID * SCALE * 0.9]} />
          <meshBasicMaterial
            color={
              cell.v < 0.4 ? "#f59e0b" : cell.v < 0.75 ? "#ef4444" : "#dc2626"
            }
            transparent
            opacity={0.15 + cell.v * 0.35}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

type TrailPoint = { agentId: string; pos: THREE.Vector3; age: number; color: string };
type TrailSegment = { key: string; from: THREE.Vector3; to: THREE.Vector3; age: number; color: string };

function TrailLine({ segment }: { segment: TrailSegment }) {
  const dx = segment.to.x - segment.from.x;
  const dz = segment.to.z - segment.from.z;
  const distance = Math.max(0.001, Math.hypot(dx, dz));
  const angle = Math.atan2(dz, dx);

  return (
    <mesh
      position={[
        (segment.from.x + segment.to.x) / 2,
        0.014,
        (segment.from.z + segment.to.z) / 2,
      ]}
      rotation={[-Math.PI / 2, 0, -angle]}
      renderOrder={99960}
    >
      <planeGeometry args={[distance, 0.028]} />
      <meshBasicMaterial
        color={segment.color}
        transparent
        opacity={Math.max(0, (1 - segment.age / 48) * 0.62)}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function TrailSystem({
  agentsRef,
  colorMap,
}: {
  agentsRef: RefObject<RenderAgent[]>;
  colorMap: Map<string, string>;
}) {
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const frameRef = useRef(0);
  const [points, setPoints] = useState<TrailPoint[]>([]);

  useFrame(() => {
    frameRef.current += 1;
    const agents = agentsRef.current ?? [];
    const trails = trailsRef.current;

    if (frameRef.current % 12 === 0) {
      for (const agent of agents) {
        if (agent.state !== "walking") continue;
        const [wx, , wz] = toWorld(agent.x, agent.y);
        const existing = trails.get(agent.id) ?? [];
        existing.unshift({
          agentId: agent.id,
          pos: new THREE.Vector3(wx, 0.018, wz),
          age: 0,
          color: colorMap.get(agent.id) ?? "#888",
        });
        if (existing.length > 4) existing.splice(4);
        trails.set(agent.id, existing);
      }
    }

    let changed = false;
    for (const [id, trailPoints] of trails) {
      for (const point of trailPoints) {
        point.age += 1;
      }
      for (let index = trailPoints.length - 1; index >= 0; index -= 1) {
        if (trailPoints[index].age < 48) continue;
        trailPoints.splice(index, 1);
        changed = true;
      }
      if (trailPoints.length === 0) {
        trails.delete(id);
        changed = true;
      }
    }

    if (frameRef.current % 8 === 0 || changed) {
      const nextPoints: TrailPoint[] = [];
      for (const trailPoints of trails.values()) nextPoints.push(...trailPoints);
      setPoints([...nextPoints]);
    }
  });

  const segments = useMemo(() => {
    const byAgent = new Map<string, TrailPoint[]>();
    for (const point of points) {
      const existing = byAgent.get(point.agentId) ?? [];
      existing.push(point);
      byAgent.set(point.agentId, existing);
    }

    const nextSegments: TrailSegment[] = [];
    for (const [agentId, trailPoints] of byAgent) {
      const ordered = [...trailPoints].sort((left, right) => left.age - right.age);
      for (let index = 0; index < ordered.length - 1; index += 1) {
        const from = ordered[index];
        const to = ordered[index + 1];
        nextSegments.push({
          key: `${agentId}-${index}-${from.age}-${to.age}`,
          from: from.pos,
          to: to.pos,
          age: Math.max(from.age, to.age),
          color: from.color,
        });
      }
    }
    return nextSegments;
  }, [points]);

  return (
    <>
      {segments.map((segment) => (
        <TrailLine key={segment.key} segment={segment} />
      ))}
      {points.map((point, index) => (
        <mesh
          key={index}
          position={[point.pos.x, point.pos.y, point.pos.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.05, 8]} />
          <meshBasicMaterial
            color={point.color}
            transparent
            opacity={Math.max(0, (1 - point.age / 48) * 0.45)}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

export function DeskNameplates({
  deskLocations,
  agents,
  deskByAgentRef,
}: {
  deskLocations: { x: number; y: number }[];
  agents: OfficeAgent[];
  deskByAgentRef: RefObject<Map<string, number>>;
}) {
  const [deskEntries, setDeskEntries] = useState<Array<[string, number]>>([]);
  const deskSignatureRef = useRef("");
  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );
  const deskAgentByIndex = useMemo(
    () => new Map(deskEntries.map(([agentId, deskIndex]) => [deskIndex, agentId])),
    [deskEntries],
  );

  useEffect(() => {
    const syncDeskEntries = () => {
      const nextEntries = [...(deskByAgentRef.current?.entries() ?? [])].sort(
        (left, right) => left[0].localeCompare(right[0]),
      );
      const nextSignature = nextEntries
        .map(([agentId, deskIndex]) => `${agentId}:${deskIndex}`)
        .join("|");
      if (nextSignature === deskSignatureRef.current) {
        return;
      }
      deskSignatureRef.current = nextSignature;
      setDeskEntries(nextEntries);
    };
    syncDeskEntries();
    const intervalId = window.setInterval(syncDeskEntries, 400);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [deskByAgentRef]);

  return (
    <>
      {deskLocations.map((desk, index) => {
        const agentId = deskAgentByIndex.get(index);
        if (!agentId) return null;
        const agent = agentById.get(agentId);
        if (!agent) return null;
        const [wx, , wz] = toWorld(desk.x, desk.y);

        return (
          <Billboard key={`nameplate-${index}`} position={[wx, 1.02, wz]}>
            <mesh position={[0, 0, -0.001]}>
              <planeGeometry args={[0.74, 0.16]} />
              <meshBasicMaterial color="#050403" transparent opacity={0.86} />
            </mesh>
            <mesh position={[-0.35, 0, 0]}>
              <planeGeometry args={[0.035, 0.16]} />
              <meshBasicMaterial color={agent.color} />
            </mesh>
            <Text
              position={[0.01, 0.002, 0.001]}
              fontSize={0.11}
              color="#fff6d8"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.64}
              outlineWidth={0.007}
              outlineColor="#16110a"
              font={undefined}
              overflowWrap="break-word"
              whiteSpace="nowrap"
            >
              {agent.name.length > 14 ? agent.name.slice(0, 13) + "…" : agent.name}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}
