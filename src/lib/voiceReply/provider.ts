import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type VoiceReplyProvider = "vibevoice" | "elevenlabs" | "edge";

export type VoiceReplySynthesisRequest = {
  text: string;
  provider?: VoiceReplyProvider;
  voiceId?: string | null;
  speed?: number;
};

const VIBEVOICE_TTS_BIN =
  process.env.VIBEVOICE_TTS_BIN?.trim() || "/home/faramix/bin/vibevoice-tts";
const EDGE_TTS_BIN = process.env.EDGE_TTS_BIN?.trim() || "/home/faramix/.local/bin/edge-tts";
const DEFAULT_VOICE_REPLY_PROVIDER: VoiceReplyProvider = "edge";
const DEFAULT_VIBEVOICE_VOICE = "en-Carter_man";
const DEFAULT_EDGE_VOICE = "nl-NL-FennaNeural";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_ELEVENLABS_MODEL_ID =
  process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5";

const inferLanguageFromVoice = (voiceId: string | null | undefined): "nl" | "en" => {
  const voice = voiceId?.trim().toLowerCase() ?? "";
  return voice.startsWith("nl-") ? "nl" : "en";
};

const defaultEdgeVoiceForLanguage = (language: "nl" | "en"): string =>
  language === "nl" ? DEFAULT_EDGE_VOICE : "en-US-JennyNeural";

const fallbackRequestForProvider = (
  request: VoiceReplySynthesisRequest,
  provider: VoiceReplyProvider
): VoiceReplySynthesisRequest => {
  if (provider !== "edge") return { ...request, provider };
  const voiceId = request.voiceId?.trim();
  const edgeVoice = voiceId?.match(/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/)
    ? voiceId
    : defaultEdgeVoiceForLanguage(inferLanguageFromVoice(request.voiceId));
  return { ...request, provider, voiceId: edgeVoice };
};

const normalizeVoiceSpeed = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(1.2, Math.max(0.7, value));
};

const normalizeVoiceId = (value: string | null | undefined, fallback: string): string => {
  const explicit = value?.trim();
  if (explicit) return explicit;
  return fallback;
};

const edgeRateFromSpeed = (speed: number): string => {
  const pct = Math.round((normalizeVoiceSpeed(speed) - 1) * 100);
  if (pct === 0) return "+0%";
  return `${pct > 0 ? "+" : ""}${pct}%`;
};

const synthesizeWithVibeVoice = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const voice = normalizeVoiceId(request.voiceId, DEFAULT_VIBEVOICE_VOICE);
  const outDir = path.join(tmpdir(), "novamaster-office-voice");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${randomUUID()}.wav`);
  try {
    await execFileAsync(VIBEVOICE_TTS_BIN, [request.text, voice, outputPath], {
      timeout: 45_000,
      maxBuffer: 1024 * 1024,
    });
    const audio = await readFile(outputPath);
    return new Response(audio, {
      status: 200,
      headers: { "Content-Type": "audio/wav" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`VibeVoice/Kokoro synthesis failed: ${detail}`);
  } finally {
    await rm(outputPath, { force: true }).catch(() => undefined);
  }
};

const synthesizeWithEdge = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const voice = normalizeVoiceId(request.voiceId, DEFAULT_EDGE_VOICE);
  const outDir = path.join(tmpdir(), "novamaster-office-voice");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `${randomUUID()}.mp3`);
  try {
    await execFileAsync(
      EDGE_TTS_BIN,
      [
        "--voice",
        voice,
        "--rate",
        edgeRateFromSpeed(request.speed ?? 1),
        "--text",
        request.text,
        "--write-media",
        outputPath,
      ],
      { timeout: 30_000, maxBuffer: 1024 * 1024 }
    );
    const audio = await readFile(outputPath);
    return new Response(audio, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Edge TTS synthesis failed: ${detail}`);
  } finally {
    await rm(outputPath, { force: true }).catch(() => undefined);
  }
};

const synthesizeWithElevenLabs = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY.");
  }
  const voiceId = request.voiceId?.trim() || DEFAULT_ELEVENLABS_VOICE_ID;
  const speed = normalizeVoiceSpeed(request.speed);
  const response = await fetch(
    `${ELEVENLABS_API_URL}/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: request.text,
        model_id: DEFAULT_ELEVENLABS_MODEL_ID,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.88,
          style: 0.2,
          use_speaker_boost: true,
          speed,
        },
      }),
      cache: "no-store",
    }
  );
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new Error(detail || "ElevenLabs voice synthesis failed.");
  }
  return response;
};

export const synthesizeVoiceReply = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  const provider = request.provider ?? DEFAULT_VOICE_REPLY_PROVIDER;
  const chain: VoiceReplyProvider[] = [
    provider,
    ...(["edge", "vibevoice", "elevenlabs"] as VoiceReplyProvider[]).filter((item) => item !== provider),
  ];
  const errors: string[] = [];

  for (const candidate of chain) {
    try {
      const nextRequest = fallbackRequestForProvider(request, candidate);
      switch (candidate) {
        case "vibevoice":
          return await synthesizeWithVibeVoice(nextRequest);
        case "edge":
          return await synthesizeWithEdge(nextRequest);
        case "elevenlabs":
          return await synthesizeWithElevenLabs(nextRequest);
        default:
          throw new Error("Unsupported voice reply provider.");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${detail}`);
    }
  }

  throw new Error(`Voice synthesis failed on all providers. ${errors.join(" | ")}`);
};
