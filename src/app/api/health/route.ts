import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";
import { readConfigAgentList } from "@/lib/gateway/agentConfig";

export const runtime = "nodejs";

const OPENCLAW_CONFIG = "openclaw.json";

const readGatewayConfig = (): Record<string, unknown> | undefined => {
  const configPath = path.join(resolveStateDir(), OPENCLAW_CONFIG);
  if (!fs.existsSync(configPath)) return undefined;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // config corrupt or unreadable
  }
  return undefined;
};

const checkGatewayPort = (): boolean => {
  const config = readGatewayConfig();
  if (!config) return false;
  const gateway = config.gateway;
  if (!gateway || typeof gateway !== "object") return false;
  const gw = gateway as Record<string, unknown>;
  const port = gw.port;
  return typeof port === "number" && Number.isFinite(port);
};

export async function GET() {
  const config = readGatewayConfig();
  const gatewayConfigured = config !== undefined;
  const agentList = config ? readConfigAgentList(config) : [];
  const gatewayPort = checkGatewayPort();
  const gatewayUrl = (() => {
    if (!config?.gateway || typeof config.gateway !== "object") return null;
    const gw = config.gateway as Record<string, unknown>;
    if (typeof gw.bind === "string") return gw.bind;
    const port = gw.port;
    if (typeof port === "number") return `ws://localhost:${port}`;
    return null;
  })();

  return NextResponse.json(
    {
      ok: true,
      service: "claw3d",
      timestamp: new Date().toISOString(),
      gateway: {
        configured: gatewayConfigured,
        port: gatewayPort ? (config?.gateway as Record<string, unknown>).port ?? null : null,
        url: gatewayUrl,
      },
      agents: {
        count: agentList.length,
        ids: agentList.map((a) => a.id),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
