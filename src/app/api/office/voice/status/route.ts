import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const timeoutSignal = (ms: number): AbortSignal => AbortSignal.timeout(ms);

const envFiles = [
  "/home/faramix/.config/novamaster/livekit.env",
  "/home/faramix/.hermes/livekit.env",
  "/home/faramix/.hermes/.env",
];

const hasExecutable = async (pathOrName: string): Promise<boolean> => {
  if (pathOrName.includes("/")) {
    try {
      await access(pathOrName, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await execFileAsync("bash", ["-lc", `command -v ${JSON.stringify(pathOrName)} >/dev/null`], {
      timeout: 2_000,
      maxBuffer: 32 * 1024,
    });
    return true;
  } catch {
    return false;
  }
};

const fetchJson = async (url: string, ms = 2_500): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> => {
  try {
    const response = await fetch(url, { cache: "no-store", signal: timeoutSignal(ms) });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text.slice(0, 200);
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const envFileHas = async (name: string): Promise<boolean> => {
  if (process.env[name]?.trim()) return true;
  for (const path of envFiles) {
    try {
      const text = await readFile(path, "utf8");
      if (text.split(/\r?\n/).some((line) => line.trim().startsWith(`${name}=`) && line.split("=", 2)[1]?.trim())) {
        return true;
      }
    } catch {
      // optional env file
    }
  }
  return false;
};

export async function GET() {
  const [edgeTts, vibeWrapper, kokoro, vibeBridge, vibeUi, livekitWorker] = await Promise.all([
    hasExecutable(process.env.EDGE_TTS_BIN?.trim() || "/home/faramix/.local/bin/edge-tts"),
    hasExecutable(process.env.VIBEVOICE_TTS_BIN?.trim() || "/home/faramix/bin/vibevoice-tts"),
    fetchJson("http://127.0.0.1:8098/health"),
    fetchJson("http://127.0.0.1:8094/health"),
    fetchJson("http://127.0.0.1:8093/health"),
    fetchJson("http://127.0.0.1:18810/"),
  ]);

  const [livekitUrl, livekitKey, livekitSecret, elevenlabsKey] = await Promise.all([
    envFileHas("LIVEKIT_URL"),
    envFileHas("LIVEKIT_API_KEY"),
    envFileHas("LIVEKIT_API_SECRET"),
    envFileHas("ELEVENLABS_API_KEY"),
  ]);

  const kokoroLive = kokoro.ok && typeof kokoro.data === "object" && kokoro.data !== null;
  const vibeTtsLive = vibeBridge.ok || vibeUi.ok;
  const audible = edgeTts || vibeWrapper || kokoroLive || vibeTtsLive;

  return NextResponse.json({
    ok: audible,
    provider_default: "edge",
    fallback_chain: ["edge", "vibevoice-wrapper", "kokoro", "elevenlabs-keyed"],
    tts: {
      audible,
      edge: { available: edgeTts, default_voice: "nl-NL-FennaNeural" },
      vibevoice: {
        wrapper_available: vibeWrapper,
        bridge_live: vibeBridge.ok,
        ui_live: vibeUi.ok,
        note: vibeTtsLive ? "vibevoice endpoint reachable" : "vibevoice endpoints offline; wrapper can still fall back",
      },
      kokoro: { live: kokoroLive, status: kokoro.status ?? null },
      elevenlabs: { key_present: elevenlabsKey },
    },
    livekit: {
      configured: livekitUrl && livekitKey && livekitSecret,
      url_present: livekitUrl,
      api_key_present: livekitKey,
      api_secret_present: livekitSecret,
      worker: livekitWorker,
    },
  });
}
