"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEcosystemMetrics } from "@/features/office/hooks/useEcosystemMetrics";

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

const HUD_METRICS: HUDMetric[] = [
  { label: "LEADS", value: "1,240", delta: "+12%", deltaPositive: true, glowColor: "cyan" },
  { label: "OUTREACH", value: "3,800", delta: "+8.2%", deltaPositive: true, glowColor: "blue" },
  { label: "RESPONSES", value: "420", delta: "+23%", deltaPositive: true, glowColor: "emerald" },
  { label: "CLOSED", value: "37", delta: "+5.4%", deltaPositive: true, glowColor: "amber" },
  { label: "REVENUE", value: "€8,920", delta: "+18%", deltaPositive: true, glowColor: "fuchsia" },
  { label: "SERVICES", value: "--", delta: "loading", deltaPositive: true, glowColor: "green" },
];

const AGENT_ZONE_MAP: Record<string, string> = {
  lead_engine: "LEADS",
  scraper_bot: "SCRAPER",
  enrichment_bot: "ENRICH",
  outreach_email: "EMAIL",
  outreach_whatsapp: "WHATSAPP",
  closer_ai: "CLOSER",
  analytics_ai: "ANALYTICS",
  content_ai: "CONTENT",
  "nova-automation": "AUTO",
  "predator-drone": "DRONE",
  "viral-engine": "VIRAL",
  commons: "COMMONS",
  pulse: "PULSE",
  orion: "ORION",
  space: "SPACE",
  main: "CORE",
};

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
  const zone = AGENT_ZONE_MAP[agent.id] ?? "AGENT";
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
        {zone}
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

function LiveEventStream() {
  const [events, setEvents] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const EVENT_TEMPLATES = [
    "lead_engine → scraped 24 new leads",
    "outreach_email → sent 12 emails",
    "enrichment_bot → enriched 8 profiles",
    "closer_ai → closed deal €420",
    "analytics_ai → report generated",
    "scraper_bot → found 3 new sources",
    "content_ai → drafted 2 posts",
    "viral-engine → trend detected",
    "nova-automation → workflow completed",
    "predator-drone → monitoring 6 targets",
    "pulse → heartbeat check passed",
    "orion → model switched to kimi-k2.6",
  ];

  useEffect(() => {
    const addEvent = () => {
      const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
      setEvents((prev) => [template, ...prev].slice(0, 5));
    };
    addEvent();
    intervalRef.current = setInterval(addEvent, 3500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-0.5 overflow-hidden">
      {events.map((event, i) => (
        <div
          key={`${event}-${i}`}
          className="flex items-center gap-1.5 font-mono text-[8px] tracking-wider text-white/30"
          style={{ opacity: 1 - i * 0.18, animation: "fadeUp 540ms cubic-bezier(0.2,0.74,0.2,1) both" }}
        >
          <span className="text-cyan-400/60">▸</span>
          {event}
        </div>
      ))}
    </div>
  );
}

function CornerFrame() {
  const cornerClass =
    "absolute h-4 w-4 border-cyan-500/30 pointer-events-none";

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
  agents = [],
  totalSpend = 0,
  totalTokens = 0,
  completedRuns = 0,
  successRate = 0,
  connected = true,
}: BusinessHUDProps) {
  const { metrics: ecosystemMetrics } = useEcosystemMetrics();
  const [visible, setVisible] = useState(true);
  const [time, setTime] = useState(new Date());
  const spendAnimated = useAnimatedCounter(Math.round(totalSpend * 100));
  const tokensAnimated = useAnimatedCounter(totalTokens);

  const liveMetrics = HUD_METRICS.map((m) => {
    if (m.label === "SERVICES" && ecosystemMetrics) {
      return {
        ...m,
        value: `${ecosystemMetrics.health.up}/${ecosystemMetrics.health.total}`,
        delta: `${ecosystemMetrics.health.pct}%`,
        deltaPositive: ecosystemMetrics.health.pct >= 80,
      };
    }
    return m;
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleHUD = useCallback(() => setVisible((v) => !v), []);

  const connectionColor = connected ? "bg-emerald-400" : "bg-rose-400";
  const connectionText = connected ? "ONLINE" : "OFFLINE";

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
        {visible ? "⬡ HUD" : "⬡ HUD"}
      </button>

      {visible ? (
        <div className="pointer-events-none fixed inset-0 z-[55] flex flex-col justify-between p-2.5">
          {/* Scanline overlay */}
          <div className="hud-scanline pointer-events-none absolute inset-0 z-[56]" />

          {/* Top strip - metrics + branding */}
          <div className="pointer-events-auto flex items-start gap-2">
            <div className="relative flex min-w-0 flex-1 gap-1 overflow-hidden rounded-xl border border-cyan-500/[0.08] bg-black/60 p-2 backdrop-blur-xl hud-border-glow">
              <CornerFrame />
              {/* NovaMaster branding */}
              <div className="mr-2 flex flex-col justify-center border-r border-cyan-500/10 pr-3">
                <div className="font-mono text-[11px] font-bold uppercase tracking-[0.32em] text-cyan-400/70 hud-glow-text hud-flicker">
                  NOVA
                </div>
                <div className="font-mono text-[7px] uppercase tracking-[0.4em] text-cyan-600/40">
                  MASTER
                </div>
                <div className="mt-1 font-mono text-[7px] text-white/20">
                  {dateStr}
                </div>
              </div>
              {liveMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </div>

          {/* Bottom strip - agents + events */}
          <div className="pointer-events-auto flex items-end gap-2">
            {/* Agent swarm */}
            <div className="relative flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-cyan-500/[0.08] bg-black/60 p-2 backdrop-blur-xl hud-border-glow">
              <CornerFrame />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${connectionColor} shadow-[0_0_6px] ${connected ? "shadow-emerald-500/50" : "shadow-rose-500/50"}`} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/45">
                    {connectionText}
                  </span>
                  <span className="font-mono text-[9px] text-white/15">|</span>
                  <span className="font-mono text-[9px] text-white/25">
                    {agents.length || Object.keys(AGENT_ZONE_MAP).length} AGENTS
                  </span>
                </div>
                <div className="font-mono text-[10px] tabular-nums tracking-wider text-cyan-400/30 hud-glow-text">
                  {timeStr}
                </div>
              </div>

              {agents.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {agents.slice(0, 12).map((agent) => (
                    <AgentPill key={agent.id} agent={agent} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(AGENT_ZONE_MAP).slice(0, 12).map(([id, zone]) => (
                    <AgentPill
                      key={id}
                      agent={{ id, name: zone, status: id === "main" ? "running" : "idle" }}
                    />
                  ))}
                </div>
              )}

              <div className="mt-1 border-t border-cyan-500/[0.06] pt-1">
                <div className="flex items-center justify-between font-mono text-[8px] tracking-wider text-white/20">
                  <span>SPEND €{formatCompact(spendAnimated / 100)}</span>
                  <span>TOKENS {formatCompact(tokensAnimated)}</span>
                  <span>RUNS {formatCompact(completedRuns)}</span>
                  <span>
                    SUCCESS {successRate > 0 ? `${Math.round(successRate * 100)}%` : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Live event stream */}
            <div className="relative w-52 rounded-xl border border-cyan-500/[0.08] bg-black/60 p-2 backdrop-blur-xl hud-border-glow">
              <CornerFrame />
              <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-400/35">
                <span className="hud-pulse h-1.5 w-1.5 rounded-full bg-cyan-400/60" />
                LIVE FEED
              </div>
              <div className="mt-1.5">
                <LiveEventStream />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}