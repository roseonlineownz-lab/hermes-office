export type CuratedVoiceOption = {
  id: string | null;
  label: string;
  description: string;
  provider: "edge" | "elevenlabs" | "vibevoice";
  language: "nl" | "en";
};

export const CURATED_VOICE_OPTIONS: CuratedVoiceOption[] = [
  {
    id: "nl-NL-FennaNeural",
    label: "Fenna NL",
    description: "Mooi helder Nederlands, natuurlijk en rustig.",
    provider: "edge",
    language: "nl",
  },
  {
    id: "nl-NL-ColetteNeural",
    label: "Colette NL",
    description: "Warme Nederlandse vrouwenstem voor uitleg en meetings.",
    provider: "edge",
    language: "nl",
  },
  {
    id: "nl-BE-DenaNeural",
    label: "Dena Vlaams",
    description: "Vlaamse/Nederlandstalige stem, vriendelijk en direct.",
    provider: "edge",
    language: "nl",
  },
  {
    id: "nl-BE-ArnaudNeural",
    label: "Arnaud Vlaams",
    description: "Vlaamse mannenstem, professioneel en kalm.",
    provider: "edge",
    language: "nl",
  },
  {
    id: "en-GB-SoniaNeural",
    label: "Sonia EN-GB",
    description: "Mooie Britse Engelse stem, warm en helder.",
    provider: "edge",
    language: "en",
  },
  {
    id: "en-US-JennyNeural",
    label: "Jenny EN-US",
    description: "Natuurlijke Amerikaanse Engelse stem voor assistent-antwoorden.",
    provider: "edge",
    language: "en",
  },
  {
    id: "en-US-GuyNeural",
    label: "Guy EN-US",
    description: "Stevige Engelse mannenstem voor ops/command voice.",
    provider: "edge",
    language: "en",
  },
  {
    id: "en-Carter_man",
    label: "Carter VibeVoice",
    description: "Lokale VibeVoice stem wanneer GPU TTS aan staat; fallback gebruikt Kokoro/Edge.",
    provider: "vibevoice",
    language: "en",
  },
  {
    id: null,
    label: "Rachel ElevenLabs",
    description: "Betaalde cloud fallback; vereist ELEVENLABS_API_KEY.",
    provider: "elevenlabs",
    language: "en",
  },
];

export const CURATED_ELEVENLABS_VOICES = CURATED_VOICE_OPTIONS;
