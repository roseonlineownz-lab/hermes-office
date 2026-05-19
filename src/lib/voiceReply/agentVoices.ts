import type { VoiceReplyProvider } from "@/lib/voiceReply/provider";

export type OfficeSpeechLanguage = "nl" | "en";

export type AgentVoiceProfile = {
  agentAliases: string[];
  label: string;
  defaultProvider: VoiceReplyProvider;
  voices: Record<VoiceReplyProvider, Record<OfficeSpeechLanguage, string>>;
  style: string;
};

export type AgentVoiceResolution = {
  provider: VoiceReplyProvider;
  voiceId: string;
  speed: number;
  locale: OfficeSpeechLanguage;
  label: string;
  profile: AgentVoiceProfile;
};

export type AgentVoiceResolveParams = {
  agentId?: string | null;
  text?: string;
  preferredProvider?: VoiceReplyProvider;
  explicitVoiceId?: string | null;
  baseSpeed?: number;
};

export const OFFICE_SPEECH_LANGUAGES: Record<OfficeSpeechLanguage, string> = {
  nl: "Nederlands",
  en: "English",
};

export const DEFAULT_OFFICE_SPEECH_LANGUAGE: OfficeSpeechLanguage = "nl";

const VX_NL_MAN = "nl-Spk0_man";
const VX_NL_WOMAN = "nl-Spk1_woman";
const VX_EN_CARTER = "en-Carter_man";
const VX_EN_EMMA = "en-Emma_woman";
const VX_EN_GRACE = "en-Grace_woman";
const VX_EN_MIKE = "en-Mike_man";

const KOKORO_VOICES = {
  hermes: { nl: "am_adam", en: "am_adam" },
  openclaw: { nl: "am_echo", en: "am_echo" },
  jarvis: { nl: "af_alloy", en: "af_alloy" },
  office: { nl: "am_onyx", en: "am_onyx" },
  qa: { nl: "bf_alice", en: "bf_alice" },
  leadgen: { nl: "am_puck", en: "am_puck" },
  media: { nl: "bf_emma", en: "bf_emma" },
  freebuff: { nl: "af_heart", en: "af_heart" },
  ops: { nl: "am_fenrir", en: "am_fenrir" },
};

const EDGE_VOICES = {
  hermes: { nl: "nl-NL-FennaNeural", en: "en-US-EmmaMultilingualNeural" },
  openclaw: { nl: "nl-NL-MaartenNeural", en: "en-US-GuyNeural" },
  jarvis: { nl: "nl-NL-ColetteNeural", en: "en-US-BrianMultilingualNeural" },
  office: { nl: "nl-NL-FennaNeural", en: "en-US-AriaNeural" },
  qa: { nl: "nl-NL-FennaNeural", en: "en-US-BrianMultilingualNeural" },
  leadgen: { nl: "nl-NL-ColetteNeural", en: "en-US-EmmaMultilingualNeural" },
  media: { nl: "nl-NL-FennaNeural", en: "en-US-EmmaMultilingualNeural" },
  freebuff: { nl: "nl-NL-ColetteNeural", en: "en-US-BrianMultilingualNeural" },
  ops: { nl: "nl-NL-MaartenNeural", en: "en-US-GuyNeural" },
};

export const AGENT_VOICE_PROFILES: Record<string, AgentVoiceProfile> = {
  hermes: {
    agentAliases: ["hermes", "hermes-gateway", "hermes-office", "office-adapter", "codex", "orchestrator", "planner"],
    label: "Hermes Orchestrator",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_MAN, en: VX_EN_CARTER },
      kokoro: KOKORO_VOICES.hermes,
      edge: EDGE_VOICES.hermes,
    },
    style: "calm, concise operator voice",
  },
  openclaw: {
    agentAliases: ["openclaw", "goclaw", "metaclaw", "clawmem", "claw"],
    label: "OpenClaw Runtime",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_MAN, en: VX_EN_MIKE },
      kokoro: KOKORO_VOICES.openclaw,
      edge: EDGE_VOICES.openclaw,
    },
    style: "direct runtime claw voice",
  },
  jarvis: {
    agentAliases: ["jarvis", "mark", "aion", "core", "command"],
    label: "Jarvis Core",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_WOMAN, en: VX_EN_EMMA },
      kokoro: KOKORO_VOICES.jarvis,
      edge: EDGE_VOICES.jarvis,
    },
    style: "clear command-center voice",
  },
  office: {
    agentAliases: ["office", "claw3d", "studio", "cockpit"],
    label: "Claw3D Office",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_WOMAN, en: VX_EN_GRACE },
      kokoro: KOKORO_VOICES.office,
      edge: EDGE_VOICES.office,
    },
    style: "visible office floor voice",
  },
  qa: {
    agentAliases: ["qa", "test", "tester", "review", "coder", "code"],
    label: "QA Lab",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_WOMAN, en: VX_EN_GRACE },
      kokoro: KOKORO_VOICES.qa,
      edge: EDGE_VOICES.qa,
    },
    style: "precise test-lab voice",
  },
  leadgen: {
    agentAliases: ["leadgen", "lead", "sales", "outreach", "scout", "research"],
    label: "LeadGen",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_MAN, en: VX_EN_MIKE },
      kokoro: KOKORO_VOICES.leadgen,
      edge: EDGE_VOICES.leadgen,
    },
    style: "fast commercial outreach voice",
  },
  media: {
    agentAliases: ["media", "publisher", "viral", "video", "voice", "livekit", "soundclaw"],
    label: "Media / SoundClaw",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_WOMAN, en: VX_EN_EMMA },
      kokoro: KOKORO_VOICES.media,
      edge: EDGE_VOICES.media,
    },
    style: "energetic media voice",
  },
  freebuff: {
    agentAliases: ["freebuff", "gordon", "remote", "windows"],
    label: "Freebuff Remote",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_MAN, en: VX_EN_CARTER },
      kokoro: KOKORO_VOICES.freebuff,
      edge: EDGE_VOICES.freebuff,
    },
    style: "remote assistant voice",
  },
  ops: {
    agentAliases: ["vps", "ops", "security", "firewall", "server", "error"],
    label: "VPS / Ops Guard",
    defaultProvider: "kokoro",
    voices: {
      vibevoice: { nl: VX_NL_MAN, en: VX_EN_MIKE },
      kokoro: KOKORO_VOICES.ops,
      edge: EDGE_VOICES.ops,
    },
    style: "firm infrastructure alert voice",
  },
};

const clampSpeed = (value: number): number => Math.min(1.2, Math.max(0.7, value));

export const normalizeOfficeSpeechLanguage = (value: unknown): OfficeSpeechLanguage => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "en" || normalized === "english" ? "en" : "nl";
};

export const detectOfficeSpeechLanguage = (text: string): OfficeSpeechLanguage => {
  const lower = text.toLowerCase();
  if (/\b(the|and|agent|running|success|error|testing|working|voice|room|meeting|ready|checks|done)\b/.test(lower)) {
    return "en";
  }
  if (/\b(de|het|een|ik|jij|werkt|klaar|fout|stem|kamer|vergadering|testen|nederlandse|nederlands|room|goed)\b/.test(lower)) {
    return "nl";
  }
  return DEFAULT_OFFICE_SPEECH_LANGUAGE;
};

const findAgentVoiceProfile = (agentId?: string | null): AgentVoiceProfile => {
  const normalized = (agentId ?? "").trim().toLowerCase();
  for (const profile of Object.values(AGENT_VOICE_PROFILES)) {
    if (profile.agentAliases.some((alias) => normalized.includes(alias))) return profile;
  }
  return AGENT_VOICE_PROFILES.hermes;
};

export function resolveAgentVoiceProfile(agentId?: string | null): AgentVoiceProfile;
export function resolveAgentVoiceProfile(params: AgentVoiceResolveParams): AgentVoiceResolution;
export function resolveAgentVoiceProfile(
  input?: string | null | AgentVoiceResolveParams,
): AgentVoiceProfile | AgentVoiceResolution {
  if (typeof input === "object" && input !== null) {
    const profile = findAgentVoiceProfile(input.agentId);
    const locale = detectOfficeSpeechLanguage(input.text ?? "");
    const provider = input.preferredProvider ?? profile.defaultProvider;
    const voiceId =
      input.explicitVoiceId ??
      profile.voices[provider]?.[locale] ??
      profile.voices[profile.defaultProvider]?.[locale] ??
      profile.voices.vibevoice[locale];
    return {
      provider,
      voiceId,
      speed: clampSpeed(input.baseSpeed ?? 1),
      locale,
      label: `${profile.label} · ${provider} · ${locale}`,
      profile,
    };
  }
  return findAgentVoiceProfile(typeof input === "string" ? input : null);
}

export const resolveAgentVoice = (
  agentId: string | null | undefined,
  language: OfficeSpeechLanguage = DEFAULT_OFFICE_SPEECH_LANGUAGE,
): AgentVoiceResolution => {
  const profile = findAgentVoiceProfile(agentId);
  const locale = normalizeOfficeSpeechLanguage(language);
  const provider = profile.defaultProvider;
  const voiceId =
    profile.voices[provider]?.[locale] ??
    profile.voices.vibevoice[locale];
  return {
    profile,
    locale,
    provider,
    voiceId,
    speed: 1,
    label: `${profile.label} · ${provider} · ${locale}`,
  };
};
