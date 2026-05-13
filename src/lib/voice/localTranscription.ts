import { inferVoiceFileExtension, normalizeVoiceMimeType, sanitizeVoiceFileName } from "@/lib/openclaw/voiceTranscription";

const DEFAULT_LOCAL_STT_URL = "http://127.0.0.1:8094/v1/audio/transcriptions";
const DEFAULT_LOCAL_STT_MODEL = "whisper-1";

type LocalSttResponse = {
  text?: unknown;
  transcript?: unknown;
  result?: unknown;
  provider?: unknown;
  model?: unknown;
};

export type LocalVoiceTranscriptionResult = {
  transcript: string | null;
  provider: string;
  model: string;
  ignored: boolean;
};

const readTranscriptionText = (payload: LocalSttResponse): string | null => {
  for (const value of [payload.text, payload.transcript, payload.result]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

export const getLocalSttUrl = (): string => {
  return process.env.CLAW3D_LOCAL_STT_URL?.trim() || process.env.LOCAL_STT_URL?.trim() || DEFAULT_LOCAL_STT_URL;
};

export const transcribeVoiceWithLocalStt = async (params: {
  buffer: Buffer;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<LocalVoiceTranscriptionResult> => {
  const mimeType = normalizeVoiceMimeType(params.mimeType);
  const fileName = sanitizeVoiceFileName(params.fileName, mimeType);
  const model = process.env.CLAW3D_LOCAL_STT_MODEL?.trim() || DEFAULT_LOCAL_STT_MODEL;
  const formData = new FormData();
  const bytes = new Uint8Array(params.buffer);
  const blob = new Blob([bytes], { type: mimeType });
  formData.append("file", blob, fileName);
  formData.append("model", model);

  const response = await fetch(getLocalSttUrl(), {
    method: "POST",
    body: formData,
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Local STT failed with ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  let payload: LocalSttResponse;
  try {
    payload = JSON.parse(bodyText) as LocalSttResponse;
  } catch {
    payload = { text: bodyText };
  }

  const transcript = readTranscriptionText(payload);
  return {
    transcript,
    provider: typeof payload.provider === "string" && payload.provider ? payload.provider : "local-stt",
    model: typeof payload.model === "string" && payload.model ? payload.model : model,
    ignored: transcript === null,
  };
};

export { inferVoiceFileExtension, normalizeVoiceMimeType, sanitizeVoiceFileName };
