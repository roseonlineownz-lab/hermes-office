"use client";

import { useEffect, useMemo, useState } from "react";

type NeuralNode = {
  id: string;
  label: string;
  kind: "agent" | "system" | "room" | "task";
  status: string;
  color: string;
  subtitle?: string | null;
  model?: string | null;
  room?: string | null;
  progress?: number | null;
  source: string[];
};

type NeuralEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "message" | "task" | "event" | "action" | "health";
  time?: string | null;
  intensity: number;
};

type NeuralMessage = {
  id: string;
  time: string | null;
  from: string;
  to: string;
  kind: "action" | "event" | "task" | "health";
  text: string;
  status?: string | null;
  source: string;
};

type NeuralPayload = {
  ok: boolean;
  generatedAt: string;
  sources: Record<string, unknown>;
  summary: {
    nodes: number;
    edges: number;
    messages: number;
    activeAgents: number;
    activeActions: number;
    orchestrator?: { statuses?: Record<string, number>; active_count?: number; total?: number };
  };
  nodes: NeuralNode[];
  edges: NeuralEdge[];
  messages: NeuralMessage[];
};

const KIND_LABEL: Record<string, string> = {
  agent: "agent",
  system: "system",
  room: "room",
  task: "task",
};

const formatTime = (value: string | null) => {
  if (!value) return "live";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "live";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const statusTone = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes("error") || s.includes("offline") || s.includes("blocked")) return "border-red-400/50 bg-red-500/15 text-red-100";
  if (s.includes("running") || s.includes("active") || s.includes("online")) return "border-emerald-300/50 bg-emerald-400/15 text-emerald-100";
  if (s.includes("waiting") || s.includes("review") || s.includes("triage")) return "border-amber-300/50 bg-amber-400/15 text-amber-100";
  return "border-sky-300/35 bg-sky-400/10 text-sky-100";
};

function useNeuralPayload() {
  const [data, setData] = useState<NeuralPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/office/neural", { cache: "no-store" });
        const payload = (await response.json()) as NeuralPayload;
        if (cancelled) return;
        setData(payload);
        setError(response.ok && payload.ok ? null : `HTTP ${response.status}`);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed to load neural data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 3500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { data, error, loading };
}

function NeuralGraph({ nodes, edges }: { nodes: NeuralNode[]; edges: NeuralEdge[] }) {
  const layout = useMemo(() => {
    const centerX = 480;
    const centerY = 310;
    const agentNodes = nodes.filter((node) => node.kind === "agent");
    const otherNodes = nodes.filter((node) => node.kind !== "agent");
    const placed = new Map<string, { x: number; y: number; node: NeuralNode }>();
    agentNodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(agentNodes.length, 1) - Math.PI / 2;
      const radius = node.status === "active" || node.status === "running" ? 230 : 205;
      placed.set(node.id, { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, node });
    });
    otherNodes.slice(0, 18).forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(otherNodes.length, 1) + Math.PI / 7;
      const radius = node.kind === "system" ? 80 : 300;
      placed.set(node.id, { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, node });
    });
    return placed;
  }, [nodes]);

  const visibleEdges = edges.filter((edge) => layout.has(edge.from) && layout.has(edge.to)).slice(-90);

  return (
    <div className="relative h-full min-h-[620px] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#030712] shadow-[0_0_80px_rgba(34,211,238,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.22),transparent_34%),radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.18),transparent_24%),radial-gradient(circle_at_80%_75%,rgba(34,197,94,0.14),transparent_26%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(125,211,252,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 960 620" aria-label="live agent neural graph">
        <defs>
          <filter id="neon"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {visibleEdges.map((edge) => {
          const from = layout.get(edge.from)!;
          const to = layout.get(edge.to)!;
          const color = edge.kind === "action" ? "#22c55e" : edge.kind === "task" ? "#facc15" : edge.kind === "health" ? "#38bdf8" : "#a78bfa";
          return (
            <g key={edge.id} filter="url(#neon)">
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={color}
                strokeOpacity={0.16 + edge.intensity * 0.42}
                strokeWidth={1 + edge.intensity * 2.5}
                strokeLinecap="round"
              />
              <circle r="3" fill={color} opacity="0.85">
                <animateMotion dur={`${3.2 - Math.min(edge.intensity, 1.0)}s`} repeatCount="indefinite" path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} />
              </circle>
            </g>
          );
        })}
      </svg>
      {[...layout.values()].map(({ x, y, node }) => {
        const size = node.kind === "agent" ? 76 : node.kind === "system" ? 66 : 48;
        return (
          <div
            key={node.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
            style={{ left: `${(x / 960) * 100}%`, top: `${(y / 620) * 100}%` }}
          >
            <div
              className="grid place-items-center rounded-full border text-xs font-bold uppercase tracking-[0.18em] text-white shadow-2xl"
              style={{ width: size, height: size, borderColor: node.color, background: `radial-gradient(circle, ${node.color}55, #020617 70%)`, boxShadow: `0 0 28px ${node.color}66` }}
            >
              {node.label.slice(0, 2)}
            </div>
            <div className="mt-2 max-w-36 rounded-xl border border-white/10 bg-black/50 px-2 py-1 backdrop-blur">
              <div className="truncate text-[11px] font-semibold text-white">{node.label}</div>
              <div className="truncate text-[9px] uppercase tracking-[0.14em] text-cyan-100/70">{KIND_LABEL[node.kind]} · {node.status}</div>
            </div>
          </div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-200/40 bg-cyan-400/10 text-center text-cyan-50 shadow-[0_0_50px_rgba(34,211,238,0.35)] backdrop-blur">
        <div>
          <div className="font-display text-3xl tracking-widest">NOVA</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/70">live bus</div>
        </div>
      </div>
    </div>
  );
}

function MessageFeed({ messages }: { messages: NeuralMessage[] }) {
  return (
    <div className="flex h-full min-h-[620px] flex-col rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl tracking-[0.12em] text-white">LIVE SIGNALS</h2>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">real actions · events · kanban handoffs</p>
        </div>
        <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">{messages.length} events</span>
      </div>
      <div className="space-y-3 overflow-auto pr-1">
        {messages.map((message) => (
          <article key={message.id} className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm font-semibold text-white">
                <span className="text-cyan-200">{message.from}</span>
                <span className="px-2 text-white/35">→</span>
                <span>{message.to}</span>
              </div>
              <time className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-white/45">{formatTime(message.time)}</time>
            </div>
            <p className="text-sm leading-relaxed text-white/78">{message.text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
              <span className={`rounded-full border px-2 py-1 ${statusTone(message.status ?? message.kind)}`}>{message.status ?? message.kind}</span>
              <span className="truncate rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/45">{message.source}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AgentList({ nodes }: { nodes: NeuralNode[] }) {
  const agents = nodes.filter((node) => node.kind === "agent");
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {agents.map((agent) => (
        <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-4 w-4 rounded-full shadow-lg" style={{ backgroundColor: agent.color, boxShadow: `0 0 18px ${agent.color}` }} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{agent.label}</div>
              <div className="truncate text-[10px] uppercase tracking-[0.16em] text-white/45">{agent.id}</div>
            </div>
          </div>
          <div className={`mb-3 inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${statusTone(agent.status)}`}>{agent.status}</div>
          <p className="line-clamp-2 min-h-9 text-xs text-white/65">{agent.subtitle ?? "No live task text yet"}</p>
          <div className="mt-3 space-y-1 text-[11px] text-white/48">
            {agent.model ? <div className="truncate">model: {agent.model}</div> : null}
            {agent.room ? <div className="truncate">room: {agent.room}</div> : null}
            {typeof agent.progress === "number" ? <div>progress: {agent.progress}%</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NeuralViewScreen() {
  const { data, error, loading } = useNeuralPayload();
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];
  const messages = data?.messages ?? [];
  const statuses = data?.summary.orchestrator?.statuses ?? {};

  return (
    <div className="min-h-screen overflow-auto bg-[#020617] p-6 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(34,211,238,0.2),transparent_28%),radial-gradient(circle_at_90%_15%,rgba(168,85,247,0.22),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(34,197,94,0.12),transparent_34%)]" />
      <div className="relative mx-auto flex max-w-[1800px] flex-col gap-5">
        <header className="flex flex-col justify-between gap-4 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">Geen mockup · live NovaMaster telemetry</div>
            <h1 className="font-display text-6xl tracking-[0.12em] text-white md:text-7xl">AGENT NEURAL VIEW</h1>
            <p className="max-w-4xl text-sm text-white/60">Echte agentstatus uit Claw3D backend, Office Action Bus, Nova events en Kanban orchestrator. Pollt live, toont lege/falende bronnen als runtime truth in plaats van verzonnen data.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="text-3xl font-bold text-cyan-100">{data?.summary.nodes ?? 0}</div><div className="text-[10px] uppercase tracking-[0.18em] text-white/45">nodes</div></div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="text-3xl font-bold text-purple-100">{data?.summary.edges ?? 0}</div><div className="text-[10px] uppercase tracking-[0.18em] text-white/45">links</div></div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="text-3xl font-bold text-emerald-100">{data?.summary.activeAgents ?? 0}</div><div className="text-[10px] uppercase tracking-[0.18em] text-white/45">agents</div></div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="text-3xl font-bold text-amber-100">{data?.summary.activeActions ?? 0}</div><div className="text-[10px] uppercase tracking-[0.18em] text-white/45">running</div></div>
          </div>
        </header>

        {(loading || error) ? (
          <div className={`rounded-2xl border p-4 ${error ? "border-red-400/40 bg-red-500/10 text-red-100" : "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"}`}>
            {error ? `Neural data error: ${error}` : "Neural telemetry laden…"}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
          <NeuralGraph nodes={nodes} edges={edges} />
          <MessageFeed messages={messages} />
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-4xl tracking-[0.12em]">AGENT FLEET</h2>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">canonical identities merged with runtime sources</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-white/60">
              {Object.entries(statuses).map(([key, value]) => (
                <span key={key} className="rounded-full border border-white/10 bg-black/25 px-3 py-1">{key}: {value}</span>
              ))}
              {data?.generatedAt ? <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">updated {formatTime(data.generatedAt)}</span> : null}
            </div>
          </div>
          <AgentList nodes={nodes} />
        </section>
      </div>
    </div>
  );
}
