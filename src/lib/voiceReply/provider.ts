import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

export type VoiceReplyProvider = "vibevoice" | "kokoro" | "edge";

const execFileAsync = promisify(execFile);

export type VoiceReplySynthesisRequest = {
  text: string;
  provider?: VoiceReplyProvider;
  voiceId?: string | null;
  speed?: number;
};

const VIBEVOICE_TTS_URL = "http://127.0.0.1:8094/v1/audio/speech";
const KOKORO_TTS_URL = process.env.KOKORO_TTS_URL || "http://127.0.0.1:8098/v1/audio/speech";

const DEFAULT_VOICE_REPLY_PROVIDER: VoiceReplyProvider = (() => {
  const configured = process.env.OFFICE_VOICE_REPLY_PROVIDER;
  if (configured === "vibevoice") return "vibevoice";
  if (configured === "kokoro") return "kokoro";
  if (configured === "edge") return "edge";
  return "vibevoice";
})();
const DEFAULT_VIBEVOICE_VOICE = process.env.VIBEVOICE_VOICE_ID || "en-Carter_man";
const DEFAULT_KOKORO_VOICE = process.env.KOKORO_VOICE_ID || "af_heart";

const normalizeVoiceSpeed = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(1.2, Math.max(0.7, value));
};

const normalizeVibeVoiceId = (value: string | null | undefined): string => {
  const explicit = value;
  if (explicit) return explicit;
  const fromEnv = process.env.VIBEVOICE_VOICE_ID;
  if (fromEnv) return fromEnv;
  return DEFAULT_VIBEVOICE_VOICE;
};

const normalizeKokoroVoiceId = (value: string | null | undefined): string => {
  const explicit = value?.trim();
  if (explicit && /^(a|b)[fm]_[a-z0-9_]+$/i.test(explicit)) return explicit;
  return DEFAULT_KOKORO_VOICE;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const synthesizeWithVibeVoice = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const voice = normalizeVibeVoiceId(request.voiceId);
  const speed = normalizeVoiceSpeed(request.speed);
  let response: Response;
  try {
    response = await fetch(VIBEVOICE_TTS_URL, {
      method: "POST",
      headers: {
        Accept: "audio/wav",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: request.text,
        voice,
        cfg_scale: speed,
      }),
      cache: "no-store",
    });
  } catch {
    throw new Error("VibeVoice service unavailable.");
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new Error(detail || "VibeVoice synthesis failed.");
  }
  return response;
};

const detectKokoroLanguage = (text: string): "en-us" | "nl" => {
  return /\b(de|het|een|en|of|niet|wel|voor|met|zonder|vergadering|kantoor|taak|klaar|werkt|nederlands)\b/i.test(text)
    ? "nl"
    : "en-us";
};

const synthesizeWithKokoro = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const voice = normalizeKokoroVoiceId(request.voiceId);
  const speed = normalizeVoiceSpeed(request.speed);
  const response = await fetch(KOKORO_TTS_URL, {
    method: "POST",
    headers: {
      Accept: "audio/wav",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: request.text,
      voice,
      speed,
      lang: detectKokoroLanguage(request.text),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new Error(detail || "Kokoro synthesis failed.");
  }
  return response;
};

const normalizeEdgeVoiceId = (value: string | null | undefined, text: string): string => {
  if (value) return value;
  return detectKokoroLanguage(text) === "nl" ? "nl-NL-FennaNeural" : "en-US-EmmaMultilingualNeural";
};

const synthesizeWithEdgeTts = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const voice = normalizeEdgeVoiceId(request.voiceId, request.text);
  const speed = normalizeVoiceSpeed(request.speed);
  const ratePct = Math.round((speed - 1) * 100);
  const rate = `${ratePct >= 0 ? "+" : ""}${ratePct}%`;
  const tmp = await mkdtemp(path.join(tmpdir(), "office-edge-tts-"));
  const mediaPath = path.join(tmp, "reply.mp3");
  try {
    await execFileAsync("edge-tts", [
      "--voice",
      voice,
      "--rate",
      rate,
      "--text",
      request.text,
      "--write-media",
      mediaPath,
    ], { timeout: 20_000, maxBuffer: 1024 * 1024 });
    const data = await readFile(mediaPath);
    return new Response(data, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Edge TTS synthesis failed.";
    throw new Error(`Edge TTS synthesis failed: ${message}`);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
};

export const synthesizeVoiceReply = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const preferred = request.provider ?? DEFAULT_VOICE_REPLY_PROVIDER;
  const preferredProvider =
    preferred === "vibevoice" || preferred === "kokoro" || preferred === "edge"
      ? preferred
      : DEFAULT_VOICE_REPLY_PROVIDER;
  const candidateProviders: VoiceReplyProvider[] = preferredProvider === "vibevoice"
    ? ["vibevoice", "kokoro", "edge"]
    : preferredProvider === "edge"
      ? ["edge", "kokoro", "vibevoice"]
      : ["kokoro", "edge", "vibevoice"];

  const errors: string[] = [];
  for (const provider of candidateProviders) {
    try {
      switch (provider) {
        case "vibevoice":
          return await synthesizeWithVibeVoice(request);
        case "kokoro":
          return await synthesizeWithKokoro(request);
        case "edge":
          return await synthesizeWithEdgeTts(request);
        default:
          throw new Error(`Unsupported voice reply provider: ${provider}.`);
      }
    } catch (error) {
      if (error instanceof Error) {
        errors.push(`${provider}: ${error.message}`);
      } else {
        errors.push(`${provider}: Unknown voice provider error.`);
      }
    }
  }

  if (errors.length === 1) {
    throw new Error(errors[0]);
  }
  throw new Error(`Voice synthesis failed: ${errors.join(" | ")}`);
};
