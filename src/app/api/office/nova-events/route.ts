import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { resolveNovaIdentity } from "@/lib/identity/novaIdentities";

export const runtime = "nodejs";

const RECEIPT_DIR =
  process.env.NOVAMASTER_RECEIPT_DIR ??
  "/home/faramix/.cache/clawmem/novamaster-receipts";

export const parseEventLine = (line: string) => {
  try {
    const payload = JSON.parse(line) as Record<string, unknown>;
    const mode =
      typeof payload.mode === "string"
        ? payload.mode
        : typeof payload.state === "string"
          ? payload.state
          : "unknown";
    const message = typeof payload.message === "string" ? payload.message : "Nova event";
    const time =
      typeof payload.time === "string"
        ? payload.time
        : typeof payload.ts === "string"
          ? payload.ts
          : null;
    const agent = typeof payload.agent === "string" && payload.agent.trim()
      ? payload.agent.trim().toLowerCase()
      : null;
    const identity = resolveNovaIdentity(`${agent ?? ""} ${message}`);
    const requestedPet = typeof payload.requestedPet === "string" && payload.requestedPet.trim()
      ? payload.requestedPet.trim()
      : null;
    return {
      mode,
      message,
      time,
      pet: payload.pet === true,
      eventbus: payload.eventbus === true,
      agent: agent ?? identity.id,
      identity: {
        id: identity.id,
        label: identity.label,
        pet: identity.pet,
        voiceProfile: identity.voiceProfile,
        color: identity.color,
        livekitIdentity: identity.livekitIdentity,
        claw3dAvatar: identity.claw3dAvatar,
        aliases: identity.aliases,
      },
      ...(requestedPet ? { requestedPet } : {}),
    };
  } catch {
    return null;
  }
};

export async function GET() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const eventLog = join(RECEIPT_DIR, "events", `${day}-nova-events.jsonl`);

  try {
    const raw = await readFile(eventLog, "utf8");
    const events = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-8)
      .map(parseEventLine)
      .filter((event): event is NonNullable<typeof event> => Boolean(event));
    const latest = events.at(-1) ?? null;

    return NextResponse.json({
      ok: true,
      source: eventLog,
      latest,
      events,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      source: eventLog,
      latest: null,
      events: [],
      error: error instanceof Error ? error.message : "event log unavailable",
    });
  }
}
