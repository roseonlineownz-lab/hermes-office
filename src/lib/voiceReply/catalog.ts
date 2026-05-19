export type CuratedVoiceOption = {
  id: string | null;
  label: string;
  description: string;
};

const CURATED_ELEVENLABS_VOICES: CuratedVoiceOption[] = [
  {
    id: null,
    label: "Rachel",
    description: "Balanced and conversational.",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    label: "Bella",
    description: "Warm and friendly.",
  },
  {
    id: "MF3mGyEYCl7XYWbV9V6O",
    label: "Elli",
    description: "Clear and upbeat.",
  },
  {
    id: "ErXwobaYiN019PkySvjV",
    label: "Antoni",
    description: "Calm and professional.",
  },
  {
    id: "TxGEqnHWrfWFTfGW9XjX",
    label: "Josh",
    description: "Steady and confident.",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    label: "Adam",
    description: "Deep and authoritative.",
  },
];

const CURATED_VIBEVOICE_VOICES: CuratedVoiceOption[] = [
  {
    id: "en-Carter_man",
    label: "En-Carter",
    description: "Default, deep friendly male Dutch-friendly profile.",
  },
  {
    id: "en-Emma_woman",
    label: "En-Emma",
    description: "Friendly female with clear diction.",
  },
  {
    id: "en-Mike_man",
    label: "En-Mike",
    description: "Neutral male narration.",
  },
  {
    id: "en-Grace_woman",
    label: "En-Grace",
    description: "Warm female support style.",
  },
  {
    id: "nl-Spk0_man",
    label: "Nl-Man",
    description: "Dutch male synthetic voice.",
  },
  {
    id: "nl-Spk1_woman",
    label: "Nl-Woman",
    description: "Dutch female synthetic voice.",
  },
];

const CURATED_KOKORO_VOICES: CuratedVoiceOption[] = [
  {
    id: "af_heart",
    label: "AF Heart",
    description: "Balanced English female.",
  },
  {
    id: "af_alloy",
    label: "AF Alloy",
    description: "Bright and energetic English",
  },
  {
    id: "am_adam",
    label: "AM Adam",
    description: "American male voice.",
  },
  {
    id: "am_puck",
    label: "AM Puck",
    description: "Playful male English accent.",
  },
  {
    id: "bf_alice",
    label: "BF Alice",
    description: "British female voice.",
  },
  {
    id: "bf_emma",
    label: "BF Emma",
    description: "British female soft tone.",
  },
];

const CURATED_EDGE_VOICES: CuratedVoiceOption[] = [
  {
    id: "nl-NL-FennaNeural",
    label: "Fenna NL",
    description: "Dutch female voice for Nederlandse replies.",
  },
  {
    id: "nl-NL-ColetteNeural",
    label: "Colette NL",
    description: "Dutch female voice with a different cadence.",
  },
  {
    id: "en-US-EmmaMultilingualNeural",
    label: "Emma multilingual",
    description: "English/Dutch-capable multilingual voice.",
  },
  {
    id: "en-US-BrianMultilingualNeural",
    label: "Brian multilingual",
    description: "English/Dutch-capable male voice.",
  },
];

export const CURATED_VOICES_BY_PROVIDER = {
  elevenlabs: CURATED_ELEVENLABS_VOICES,
  vibevoice: CURATED_VIBEVOICE_VOICES,
  kokoro: CURATED_KOKORO_VOICES,
  edge: CURATED_EDGE_VOICES,
} satisfies Record<string, CuratedVoiceOption[]>;

export const getVoicesForProvider = (provider: string): CuratedVoiceOption[] => {
  const value = provider.toLowerCase();
  if (value === "kokoro") return CURATED_KOKORO_VOICES;
  if (value === "edge") return CURATED_EDGE_VOICES;
  if (value === "vibevoice") return CURATED_VIBEVOICE_VOICES;
  if (value === "elevenlabs") return CURATED_ELEVENLABS_VOICES;
  return CURATED_VIBEVOICE_VOICES;
};
