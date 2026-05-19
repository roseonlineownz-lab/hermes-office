import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ServiceHealth = {
  ok: boolean;
  reachable: boolean;
  status?: number;
  detail?: unknown;
};

const fetchJsonHealth = async (url: string): Promise<ServiceHealth> => {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    const text = await response.text();
    let detail: unknown = text;
    try {
      detail = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }
    return { ok: response.ok, reachable: true, status: response.status, detail };
  } catch (error) {
    return {
      ok: false,
      reachable: false,
      detail: error instanceof Error ? error.message : "unreachable",
    };
  }
};

const boolFromDetail = (detail: unknown, key: string): boolean | null => {
  if (!detail || typeof detail !== "object") return null;
  const value = (detail as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
};

export async function GET() {
  const [vibevoice, kokoro] = await Promise.all([
    fetchJsonHealth("http://127.0.0.1:8094/health"),
    fetchJsonHealth("http://127.0.0.1:8098/health"),
  ]);

  const vibevoiceTts = boolFromDetail(vibevoice.detail, "tts");
  const vibevoiceStt = boolFromDetail(vibevoice.detail, "stt");
  const kokoroLoaded = boolFromDetail(kokoro.detail, "loaded");
  const kokoroOk = kokoro.ok && (kokoroLoaded ?? true);
  const activeTtsProvider = vibevoice.ok && vibevoiceTts !== false
    ? "vibevoice"
    : kokoroOk
      ? "kokoro"
      : null;

  return NextResponse.json({
    ok: Boolean(activeTtsProvider),
    activeTtsProvider,
    fallbackActive: activeTtsProvider === "kokoro",
    vibevoice: {
      reachable: vibevoice.reachable,
      ok: vibevoice.ok,
      tts: vibevoiceTts,
      stt: vibevoiceStt,
      detail: vibevoice.detail,
    },
    kokoro: {
      reachable: kokoro.reachable,
      ok: kokoro.ok,
      loaded: kokoroLoaded,
      detail: kokoro.detail,
    },
  });
}
