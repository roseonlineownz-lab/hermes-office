import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SERVICES = [
  { name: "NovaMaster Office", url: "http://127.0.0.1:3000/", category: "core" },
  { name: "Hermes Adapter", url: "http://127.0.0.1:18789/health", category: "core" },
  { name: "Hermes API", url: "http://127.0.0.1:8642/health", category: "core" },
  { name: "OpenClaw Gateway", url: "http://127.0.0.1:18791/", category: "core" },
  { name: "GoClaw", url: "http://127.0.0.1:18790/health", category: "core" },
  { name: "MetaClaw", url: "http://127.0.0.1:30000/health", category: "core" },
  { name: "Space Agent", url: "http://127.0.0.1:3003/", category: "core" },
  { name: "JARVIS", url: "http://127.0.0.1:8888/health", category: "core" },
  { name: "JARVIS Bridge", url: "http://127.0.0.1:7777/health", category: "core" },
  { name: "Ollama", url: "http://127.0.0.1:11434/api/version", category: "ai" },
  { name: "LiteLLM", url: "http://127.0.0.1:4000/", category: "ai" },
  { name: "NovaMaster API", url: "http://127.0.0.1:8091/health", category: "ai" },
  { name: "Qdrant", url: "http://127.0.0.1:6333/healthz", category: "db" },
  { name: "Grafana", url: "http://127.0.0.1:3001/api/health", category: "monitoring" },
  { name: "Prometheus", url: "http://127.0.0.1:9090/-/healthy", category: "monitoring" },
  { name: "n8n", url: "http://127.0.0.1:5678/healthz", category: "workflow" },
  { name: "Open WebUI", url: "http://127.0.0.1:3080/", category: "ui" },
  { name: "ComfyUI", url: "http://127.0.0.1:8188/", category: "ui" },
  { name: "CrabTrap", url: "http://127.0.0.1:8082/", category: "events" },
];

async function checkService(url: string, timeout = 3000): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    return res.status < 500;
  } catch {
    return false;
  }
}

export async function GET() {
  const checks = await Promise.all(
    SERVICES.map(async (svc) => {
      const up = await checkService(svc.url);
      return { ...svc, up };
    }),
  );

  const upCount = checks.filter((c) => c.up).length;
  const total = checks.length;

  const byCategory: Record<string, { up: number; total: number }> = {};
  for (const c of checks) {
    if (!byCategory[c.category]) byCategory[c.category] = { up: 0, total: 0 };
    byCategory[c.category].total++;
    if (c.up) byCategory[c.category].up++;
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    health: { up: upCount, total, pct: Math.round((upCount / total) * 100) },
    services: checks.map((c) => ({ name: c.name, category: c.category, up: c.up, url: c.url })),
    byCategory,
  });
}