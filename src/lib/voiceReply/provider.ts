export type VoiceReplyProvider = "elevenlabs" | "vibevoice" | "kokoro";

export type VoiceReplySynthesisRequest = {
  text: string;
  provider?: VoiceReplyProvider;
  voiceId?: string | null;
  speed?: number;
};

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const VIBEVOICE_TTS_URL = "http://127.0.0.1:8094/v1/audio/speech";
const KOKORO_TTS_URL = process.env.KOKORO_TTS_URL?.trim() ||
  "http://127.0.0.1:8098/v1/audio/speech";

const DEFAULT_VOICE_REPLY_PROVIDER: VoiceReplyProvider = (() => {
  const configured = process.env.OFFICE_VOICE_REPLY_PROVIDER?.trim().toLowerCase();
  if (configured === "elevenlabs") return "elevenlabs";
  if (configured === "kokoro") return "kokoro";
  return "vibevoice";
})();
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_ELEVENLABS_MODEL_ID =
  process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5";
const DEFAULT_VIBEVOICE_VOICE = process.env.VIBEVOICE_VOICE_ID?.trim() || "en-Carter_man";
const DEFAULT_KOKORO_VOICE = process.env.KOKORO_VOICE_ID?.trim() || "af_heart";

const normalizeVoiceSpeed = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(1.2, Math.max(0.7, value));
};

const normalizeVoiceId = (value: string | null | undefined): string => {
  const explicit = value?.trim();
  if (explicit) return explicit;
  const fromEnv = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_ELEVENLABS_VOICE_ID;
};

const normalizeVibeVoiceId = (value: string | null | undefined): string => {
  const explicit = value?.trim();
  if (explicit) return explicit;
  const fromEnv = process.env.VIBEVOICE_VOICE_ID?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_VIBEVOICE_VOICE;
};

const normalizeKokoroVoiceId = (value: string | null | undefined): string => {
  const explicit = value?.trim();
  if (explicit) return explicit;
  return DEFAULT_KOKORO_VOICE;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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
  } catch (error) {
    throw new Error("VibeVoice service unavailable.");
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new Error(detail || "VibeVoice synthesis failed.");
  }
  return response;
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
      lang: "en-us",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).trim();
    throw new Error(detail || "Kokoro synthesis failed.");
  }
  return response;
};

const synthesizeWithElevenLabs = async (
  request: VoiceReplySynthesisRequest
): Promise<Response> => {
  // TODO: Create Claw3D voice and text skill.
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY.");
  }
  const voiceId = normalizeVoiceId(request.voiceId);
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
  const preferred = request.provider ?? DEFAULT_VOICE_REPLY_PROVIDER;
  const preferredProvider =
    preferred === "elevenlabs" || preferred === "vibevoice" || preferred === "kokoro"
      ? preferred
      : DEFAULT_VOICE_REPLY_PROVIDER;
  const candidateProviders: VoiceReplyProvider[] = preferredProvider === "elevenlabs"
    ? ["elevenlabs", "vibevoice", "kokoro"]
    : preferredProvider === "kokoro"
      ? ["kokoro", "vibevoice", "elevenlabs"]
      : ["vibevoice", "kokoro", "elevenlabs"];

  const errors: string[] = [];
  for (const provider of candidateProviders) {
    try {
      switch (provider) {
        case "vibevoice":
          return await synthesizeWithVibeVoice(request);
        case "elevenlabs":
          return await synthesizeWithElevenLabs(request);
        case "kokoro":
          return await synthesizeWithKokoro(request);
        default:
          throw new Error(`Unsupported voice reply provider: ${provider}.`);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Missing ELEVENLABS_API_KEY") && isNonEmptyString(request.provider)) {
          throw error;
        }
        errors.push(error.message);
      } else {
        errors.push("Unknown voice provider error.");
      }
    }
  }

  if (errors.length === 1) {
    throw new Error(errors[0]);
  }
  throw new Error(`Voice synthesis failed across providers: ${errors.join(" | ")}`);
};
