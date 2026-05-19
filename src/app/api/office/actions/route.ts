import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { resolveNovaIdentity } from "@/lib/identity/novaIdentities";

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
  room: string | null;
  status: "running" | "success" | "error" | "waiting" | "unknown";
  progress: number | null;
  phase: string | null;
  lastLog: string | null;
  receipt: string | null;
  identity: {
    id: string;
    label: string;
    pet: string;
    voiceProfile: string;
    color: string;
    livekitIdentity: string;
    claw3dAvatar: string;
    aliases: string[];
  };
};

const identityFor = (agent: string, text = "") => {
  const identity = resolveNovaIdentity(`${agent} ${text}`);
  return {
    id: identity.id,
    label: identity.label,
    pet: identity.pet,
    voiceProfile: identity.voiceProfile,
    color: identity.color,
    livekitIdentity: identity.livekitIdentity,
    claw3dAvatar: identity.claw3dAvatar,
    aliases: identity.aliases,
  };
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const clampText = (value: string | null, max = 220): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
};

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

const ACTIVE_ACTION_TTL_MS = 20 * 60 * 1000;

const actionAgeMs = (action: OfficeAction, nowMs: number): number | null => {
  if (!action.time) return null;
  const parsed = Date.parse(action.time);
  return Number.isFinite(parsed) ? nowMs - parsed : null;
};

const isActiveAction = (action: OfficeAction, nowMs: number) => {
  if (action.status !== "running" && action.status !== "waiting") return false;
  const ageMs = actionAgeMs(action, nowMs);
  if (ageMs === null) return true;
  return ageMs <= ACTIVE_ACTION_TTL_MS;
};

const parseActionLine = (line: string): OfficeAction | null => {
  try {
    const payload = JSON.parse(line) as Record<string, unknown>;
    const id = asString(payload.id) ?? asString(payload.run_id) ?? `${Date.now()}`;
    const agent = asString(payload.agent) ?? "hermes";
    const title = asString(payload.title) ?? asString(payload.task) ?? "Nova action";
    const identity = identityFor(agent, title);
    return {
      id,
      time: asString(payload.time) ?? asString(payload.ts),
      agent,
      title,
      command: asString(payload.command),
      room: asString(payload.room),
      status: asStatus(payload.status),
      progress: asProgress(payload.progress),
      phase: asString(payload.phase),
      lastLog: asString(payload.lastLog) ?? asString(payload.last_log),
      receipt: asString(payload.receipt),
      identity,
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
    const nowMs = Date.now();
    const active = collapsed.filter((action) => isActiveAction(action, nowMs));
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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = asString(payload.id) ?? asString(payload.run_id) ?? `office-${Date.now()}`;
    const now = new Date().toISOString();
    const actionAgent = asString(payload.agent) ?? "hermes";
    const actionTitle = clampText(asString(payload.title) ?? asString(payload.task), 120) ?? "Office action";
    const action: OfficeAction = {
      id,
      time: asString(payload.time) ?? asString(payload.ts) ?? now,
      agent: actionAgent,
      title: actionTitle,
      command: clampText(asString(payload.command), 220),
      room: asString(payload.room),
      status: asStatus(payload.status),
      progress: asProgress(payload.progress),
      phase: clampText(asString(payload.phase), 80),
      lastLog: clampText(asString(payload.lastLog) ?? asString(payload.last_log), 220),
      receipt: asString(payload.receipt),
      identity: identityFor(actionAgent, actionTitle),
    };
    await mkdir(join(RECEIPT_DIR, "actions"), { recursive: true });
    await appendFile(ACTION_LOG, `${JSON.stringify(action)}\n`, "utf8");
    return NextResponse.json({ ok: true, action });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        source: ACTION_LOG,
        error: error instanceof Error ? error.message : "failed to append action",
      },
      { status: 500 },
    );
  }
}
