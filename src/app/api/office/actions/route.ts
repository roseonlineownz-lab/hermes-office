import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const RECEIPT_DIR =
  process.env.NOVAMASTER_RECEIPT_DIR ??
  "/home/faramix/.cache/clawmem/novamaster-receipts";

const ACTION_LOG = join(RECEIPT_DIR, "actions", "office-actions.jsonl");

type OfficeAction = {
  id: string;
  time: string | null;
  agent: string;
  title: string;
  command: string | null;
  status: "running" | "success" | "error" | "waiting" | "unknown";
  progress: number | null;
  phase: string | null;
  lastLog: string | null;
  receipt: string | null;
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asProgress = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const asStatus = (value: unknown): OfficeAction["status"] => {
  const status = asString(value)?.toLowerCase();
  if (
    status === "running" ||
    status === "success" ||
    status === "error" ||
    status === "waiting"
  ) {
    return status;
  }
  return "unknown";
};

const parseActionLine = (line: string): OfficeAction | null => {
  try {
    const payload = JSON.parse(line) as Record<string, unknown>;
    const id = asString(payload.id) ?? asString(payload.run_id) ?? `${Date.now()}`;
    const agent = asString(payload.agent) ?? "hermes";
    const title = asString(payload.title) ?? asString(payload.task) ?? "Nova action";
    return {
      id,
      time: asString(payload.time) ?? asString(payload.ts),
      agent,
      title,
      command: asString(payload.command),
      status: asStatus(payload.status),
      progress: asProgress(payload.progress),
      phase: asString(payload.phase),
      lastLog: asString(payload.lastLog) ?? asString(payload.last_log),
      receipt: asString(payload.receipt),
    };
  } catch {
    return null;
  }
};

export async function GET() {
  try {
    const raw = await readFile(ACTION_LOG, "utf8");
    const actions = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-30)
      .map(parseActionLine)
      .filter((action): action is OfficeAction => Boolean(action));
    const latestById = new Map<string, OfficeAction>();
    for (const action of actions) {
      latestById.set(action.id, action);
    }
    const collapsed = Array.from(latestById.values());
    const active = collapsed.filter((action) => action.status === "running" || action.status === "waiting");
    return NextResponse.json({
      ok: true,
      source: ACTION_LOG,
      active,
      recent: collapsed.slice(-12).reverse(),
      latest: collapsed.at(-1) ?? null,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      source: ACTION_LOG,
      active: [],
      recent: [],
      latest: null,
      error: error instanceof Error ? error.message : "action log unavailable",
    });
  }
}
