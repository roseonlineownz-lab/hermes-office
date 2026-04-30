"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEcosystemMetrics } from "@/features/office/hooks/useEcosystemMetrics";
import { useClaw3DBackend } from "@/features/office/hooks/useClaw3DBackend";

type HUDMetric = {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  glowColor?: string;
};

type AgentStatusEntry = {
  id: string;
  name: string;
  status: "running" | "idle" | "error" | "connecting";
  runs?: number;
  lastAction?: string;
};

type BusinessHUDProps = {
  agents?: AgentStatusEntry[];
  totalSpend?: number;
  totalTokens?: number;
  completedRuns?: number;
  successRate?: number;
  connected?: boolean;
};

const PULSE_DURATION = 2400;

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function useAnimatedCounter(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const start = useRef(Date.now());
  const from = useRef(target);

  useEffect(() => {
    if (prev.current === target) return;
    from.current = prev.current;
    prev.current = target;
    start.current = Date.now();
    const frame = () => {
      const elapsed = Date.now() - start.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from.current + (target - from.current) * eased));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return () => {};
  }, [target, duration]);

  return display;
}

const GLOW_COLORS: Record<string, string> = {
  cyan: "#22d3ee",
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  fuchsia: "#d946ef",
  green: "#22c55e",
  red: "#ef4444",
};

function MetricCard({ metric }: { metric: HUDMetric }) {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    const color = GLOW_COLORS[metric.glowColor ?? "cyan"] ?? GLOW_COLORS.cyan;
    const keyframes: Keyframe[] = [
      { boxShadow: `0 0 6px ${color}40, 0 0 16px ${color}15`, borderColor: `${color}50` },
      { boxShadow: `0 0 14px ${color}60, 0 0 36px ${color}28`, borderColor: `${color}90` },
      { boxShadow: `0 0 6px ${color}40, 0 0 16px ${color}15`, borderColor: `${color}50` },
    ];
    const anim = el.animate(keyframes, {
      duration: PULSE_DURATION,
      iterations: Infinity,
      easing: "ease-in-out",
    });
    return () => anim.cancel();
  }, [metric.glowColor]);

  return (
    <div
      ref={glowRef}
      className="hud-metric-card group relative flex min-w-0 flex-1 flex-col rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] px-2.5 py-2 backdrop-blur-sm transition-all duration-200 hover:border-white/[0.15] hover:from-white/[0.08] hover:to-white/[0.02]"
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/30">
        {metric.label}
      </div>
      <div className="mt-1 font-mono text-[18px] font-bold tracking-tight text-white/90 hud-glow-text">
        {metric.value}
      </div>
      {metric.delta ? (
        <div
          className={`mt-0.5 font-mono text-[9px] font-medium tracking-wider ${
            metric.deltaPositive ? "text-emerald-400/80" : "text-rose-400/80"
          }`}
        >
          {metric.deltaPositive ? "▲" : "▼"} {metric.delta}
        </div>
      ) : null}
    </div>
  );
}

function AgentPill({ agent }: { agent: AgentStatusEntry }) {
  const statusColor =
    agent.status === "running"
      ? "bg-emerald-400 shadow-[0_0_4px_#10b98150]"
      : agent.status === "error"
        ? "bg-rose-400 shadow-[0_0_4px_#ef444450]"
        : agent.status === "connecting"
          ? "bg-amber-400 shadow-[0_0_4px_#f59e0b50]"
          : "bg-white/25";

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 transition-all hover:border-white/[0.1] hover:bg-white/[0.05]">
      <span className={`h-1.5 w-1.5 rounded-full ${statusColor} ${agent.status === "running" ? "hud-pulse" : ""}`} />
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/55">
        {agent.id.replace(/[-_]/g, " ").toUpperCase().slice(0, 10)}
      </span>
      <span className="font-mono text-[9px] text-white/20">|</span>
      <span className="max-w-[60px] truncate font-mono text-[9px] text-white/40">
        {agent.name}
      </span>
      {agent.runs !== undefined ? (
        <span className="font-mono text-[8px] text-white/20">{agent.runs}r</span>
      ) : null}
    </div>
  );
}

function RoomCard({ name, agents, icon }: { name: string; agents: AgentStatusEntry[]; icon: string }) {
  const onlineCount = agents.filter((a) => a.status === "running" || a.status === "idle").length;

  return (
    <div className="flex min-w-[9rem] flex-col gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 backdrop-blur-sm transition-all hover:border-cyan-500/20 hover:bg-white/[0.05]">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white/70">
          {name}
        </span>
      </div>
      <div className="font-mono text-[8px] text-white/30">
        {onlineCount}/{agents.length} active
      </div>
    </div>
  );
}

function AutopilotToggle({ mode, onToggle }: { mode: "manual" | "autopilot"; onToggle: () => void }) {
  const isAuto = mode === "autopilot";
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest transition-all ${
        isAuto
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_#10b98120] hover:border-emerald-400/60"
          : "border-white/[0.08] bg-white/[0.03] text-white/40 hover:border-white/[0.15] hover:text-white/60"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isAuto ? "bg-emerald-400 hud-pulse" : "bg-white/20"}`} />
      {isAuto ? "AUTOPILOT" : "MANUAL"}
    </button>
  );
}

function LiveEventStream({ events }: { events: { ts: string; agent: string; type: string; message: string }[] }) {
  return (
    <div className="flex flex-col gap-0.5 overflow-hidden">
      {events.slice(0, 5).map((event, i) => (
        <div
          key={`${event.ts}-${i}`}
          className="flex items-center gap-1.5 font-mono text-[8px] tracking-wider text-white/30"
          style={{ opacity: 1 - i * 0.18 }}
        >
          <span className="text-cyan-400/60">▸</span>
          <span className="text-white/50">{event.agent}</span>
          <span className="text-white/20">→</span>
          <span className="text-white/30 truncate">{event.message}</span>
        </div>
      ))}
      {events.length === 0 && (
        <div className="font-mono text-[8px] text-white/15">Waiting for events...</div>
      )}
    </div>
  );
}

function ServiceDots({ services }: { services: { name: string; status: string }[] }) {
  const online = services.filter((s) => s.status === "online").length;
  const total = services.length;

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {services.slice(0, 12).map((s, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${s.status === "online" ? "bg-emerald-400/70" : "bg-rose-400/50"}`}
            title={`${s.name}: ${s.status}`}
          />
        ))}
      </div>
      <span className="font-mono text-[8px] text-white/25">
        {online}/{total}
      </span>
    </div>
  );
}

function ResourceBar({ label, value, color = "cyan" }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    cyan: "bg-cyan-400/70",
    blue: "bg-blue-400/70",
    emerald: "bg-emerald-400/70",
    amber: "bg-amber-400/70",
    fuchsia: "bg-fuchsia-400/70",
  };
  const barColor = colorMap[color] ?? colorMap.cyan;
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 font-mono text-[8px] uppercase tracking-wider text-white/30">{label}</span>
      <div className="h-1 flex-1 rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-right font-mono text-[8px] text-white/35">{Math.round(pct)}%</span>
    </div>
  );
}

function CornerFrame() {
  const cornerClass = "absolute h-4 w-4 border-cyan-500/30 pointer-events-none";

  return (
    <>
      <div className={`${cornerClass} left-0 top-0 border-l-2 border-t-2 rounded-tl-sm`} />
      <div className={`${cornerClass} right-0 top-0 border-r-2 border-t-2 rounded-tr-sm`} />
      <div className={`${cornerClass} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-sm`} />
      <div className={`${cornerClass} bottom-0 right-0 border-b-2 border-r-2 rounded-br-sm`} />
    </>
  );
}

export function BusinessHUD({
  agents: propAgents = [],
  totalSpend = 0,
  totalTokens = 0,
  completedRuns = 0,
  successRate = 0,
  connected: propConnected = true,
}: BusinessHUDProps) {
  const { metrics: ecosystemMetrics } = useEcosystemMetrics();
  const backend = useClaw3DBackend();
  const [visible, setVisible] = useState(true);
  const [time, setTime] = useState(new Date());
  const spendAnimated = useAnimatedCounter(Math.round(totalSpend * 100));
  const tokensAnimated = useAnimatedCounter(totalTokens);

  const isBackendConnected = backend.connected;
  const mode = backend.overview?.mode ?? "manual";
  const money = backend.overview?.money ?? { revenueToday: 0, leadsToday: 0, outreachSent: 0, responsesReceived: 0, conversionRate: 0, pipelineValue: 0 };
  const completedToday = backend.overview?.completedToday ?? completedRuns;

  // Merge backend agents with prop agents
  const mergedAgents: AgentStatusEntry[] = isBackendConnected && backend.agents.length > 0
    ? backend.agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: (a.status === "online" ? "running" : a.status === "idle" ? "idle" : a.status === "running" ? "running" : "error") as AgentStatusEntry["status"],
      }))
    : propAgents;

  // Build room groups from backend agents
  const roomMap = backend.agents.length > 0
    ? backend.agents.reduce<Record<string, AgentStatusEntry[]>>((acc, a) => {
        const room = a.room || "Other";
        if (!acc[room]) acc[room] = [];
        acc[room].push({
          id: a.id,
          name: a.name,
          status: (a.status === "online" ? "running" : a.status === "idle" ? "idle" : "error") as AgentStatusEntry["status"],
        });
        return acc;
      }, {})
    : {};

  const roomIcons: Record<string, string> = {
    "Mission Control": "🧠",
    "Dev Lab": "💻",
    "Lead Engine": "🎯",
    "Marketing Hub": "📱",
    "Automation Core": "⚡",
    "Data Center": "📊",
  };

  // Dynamic metrics from backend
  const liveMetrics: HUDMetric[] = isBackendConnected
    ? [
        { label: "LEADS", value: String(money.leadsToday), delta: money.leadsToday > 0 ? `+${money.leadsToday}` : undefined, deltaPositive: true, glowColor: "cyan" },
        { label: "OUTREACH", value: String(money.outreachSent), delta: money.outreachSent > 0 ? `+${money.outreachSent}` : undefined, deltaPositive: true, glowColor: "blue" },
        { label: "RESPONSES", value: String(money.responsesReceived), delta: money.conversionRate > 0 ? `${(money.conversionRate * 100).toFixed(0)}%` : undefined, deltaPositive: true, glowColor: "emerald" },
        { label: "CLOSED", value: String(completedToday), delta: completedToday > 0 ? `+${completedToday}` : undefined, deltaPositive: true, glowColor: "amber" },
        { label: "REVENUE", value: `€${formatCompact(money.revenueToday)}`, delta: money.pipelineValue > 0 ? `€${formatCompact(money.pipelineValue)} pipe` : undefined, deltaPositive: true, glowColor: "fuchsia" },
        { label: "SERVICES", value: ecosystemMetrics ? `${ecosystemMetrics.health.up}/${ecosystemMetrics.health.total}` : "--", delta: ecosystemMetrics ? `${ecosystemMetrics.health.pct}%` : "loading", deltaPositive: ecosystemMetrics ? ecosystemMetrics.health.pct >= 80 : true, glowColor: "green" },
      ]
    : [
        { label: "LEADS", value: "1,240", delta: "+12%", deltaPositive: true, glowColor: "cyan" },
        { label: "OUTREACH", value: "3,800", delta: "+8.2%", deltaPositive: true, glowColor: "blue" },
        { label: "RESPONSES", value: "420", delta: "+23%", deltaPositive: true, glowColor: "emerald" },
        { label: "CLOSED", value: "37", delta: "+5.4%", deltaPositive: true, glowColor: "amber" },
        { label: "REVENUE", value: "€8,920", delta: "+18%", deltaPositive: true, glowColor: "fuchsia" },
        { label: "SERVICES", value: "--", delta: "loading", deltaPositive: true, glowColor: "green" },
      ];

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleHUD = useCallback(() => setVisible((v) => !v), []);

  const handleAutopilotToggle = useCallback(async () => {
    const newMode = mode === "manual" ? "autopilot" : "manual";
    await backend.sendCommand(newMode);
  }, [mode, backend]);

  const connectionColor = (propConnected || isBackendConnected) ? "bg-emerald-400" : "bg-rose-400";
  const connectionText = (propConnected || isBackendConnected) ? "ONLINE" : "OFFLINE";

  const timeStr = time.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggleHUD}
        className="pointer-events-auto fixed left-3 top-3 z-[60] rounded border border-cyan-500/20 bg-black/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-400/50 shadow-[0_0_12px_#22d3ee15] backdrop-blur-md transition-all hover:border-cyan-400/40 hover:text-cyan-300/80 hover:shadow-[0_0_16px_#22d3ee25]"
        aria-label={visible ? "Hide business HUD" : "Show business HUD"}
      >
        ⬡ HUD
      </button>

      {visible ? (
        <div className="pointer-events-none fixed inset-0 z-[55] flex flex-col justify-between p-2.5">
          {/* Scanline overlay */}
          <div className="hud-scanline pointer-events-none absolute inset-0 z-[56]" />

          {/* Top strip - metrics + branding */}
          <div className="pointer-events-auto flex items-start gap-2">
            <div className="relative flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-cyan-500/[0.08] bg-black/60 p-2 backdrop-blur-xl hud-border-glow">
              <CornerFrame />
              {/* NovaMaster branding */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 border-r border-cyan-500/10 pr-3">
                  <div className="flex flex-col justify-center">
                    <div className="font-mono text-[11px] font-bold uppercase tracking-[0.32em] text-cyan-400/70 hud-glow-text hud-flicker">
                      NOVA
                    </div>
                    <div className="font-mono text-[7px] uppercase tracking-[0.4em] text-cyan-600/40">
                      MASTER
                    </div>
                    <div className="mt-0.5 font-mono text-[7px] text-white/20">
                      {dateStr}
                    </div>
                  </div>
                  <AutopilotToggle mode={mode} onToggle={handleAutopilotToggle} />
                </div>
                <ServiceDots services={backend.services.length > 0 ? backend.services : []} />
              </div>
              {liveMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </div>

          {/* Middle strip - rooms */}
          {Object.keys(roomMap).length > 0 && (
            <div className="pointer-events-auto flex items-center gap-2">
              <div className="flex gap-2 overflow-x-auto rounded-xl border border-cyan-500/[0.08] bg-black/60 p-2 backdrop-blur-xl hud-border-glow" style={{ scrollbarWidth: "none" }}>
                {Object.entries(roomMap).map(([roomName, roomAgents]) => (
                  <RoomCard
                    key={roomName}
                    name={roomName}
                    agents={roomAgents}
                    icon={roomIcons[roomName] ?? "🏠"}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bottom strip - agents + events + resources */}
          <div className="pointer-events-auto flex items-end gap-2">
            {/* Agent swarm */}
            <div className="relative flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-cyan-500/[0.08] bg-black/60 p-2 backdrop-blur-xl hud-border-glow">
              <CornerFrame />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${connectionColor} shadow-[0_0_6px] ${connectionColor.includes("emerald") ? "shadow-emerald-500/50" : "shadow-rose-500/50"}`} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/45">
                    {connectionText}
                  </span>
                  <span className="font-mono text-[9px] text-white/15">|</span>
                  <span className="font-mono text-[9px] text-white/25">
                    {mergedAgents.length} AGENTS
                  </span>
                </div>
                <div className="font-mono text-[10px] tabular-nums tracking-wider text-cyan-400/30 hud-glow-text">
                  {timeStr}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {mergedAgents.slice(0, 12).map((agent) => (
                  <AgentPill key={agent.id} agent={agent} />
                ))}
              </div>

              <div className="mt-1 border-t border-cyan-500/[0.06] pt-1">
                <div className="flex items-center justify-between font-mono text-[8px] tracking-wider text-white/20">
                  <span>SPEND €{formatCompact(spendAnimated / 100)}</span>
                  <span>TOKENS {formatCompact(tokensAnimated)}</span>
                  <span>RUNS {formatCompact(completedToday)}</span>
                  <span>
                    SUCCESS {successRate > 0 ? `${Math.round(successRate * 100)}%` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Resource monitor */}
            {backend.resources && (
              <div className="relative w-40 rounded-xl border border-cyan-500/[0.08] bg-black/60 p-2 backdrop-blur-xl hud-border-glow">
                <CornerFrame />
                <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-400/35">
                  <span className="hud-pulse h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
                  RESOURCES
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  <ResourceBar label="CPU" value={backend.resources.cpu} color="cyan" />
                  <ResourceBar label="RAM" value={backend.resources.memory} color="blue" />
                  <ResourceBar label="DISK" value={backend.resources.storage} color="emerald" />
                  {backend.resources.gpu !== null && (
                    <ResourceBar label="GPU" value={backend.resources.gpu} color="fuchsia" />
                  )}
                </div>
              </div>
            )}

            {/* Live event stream */}
            <div className="relative w-52 rounded-xl border border-cyan-500/[0.08] bg-black/60 p-2 backdrop-blur-xl hud-border-glow">
              <CornerFrame />
              <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-400/35">
                <span className="hud-pulse h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
                LIVE FEED
              </div>
              <div className="mt-1.5">
                <LiveEventStream events={backend.events.length > 0 ? backend.events : []} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}