---
name: voice-nova
description: Speak as Nova or transcribe user audio via the VibeVoice Bridge. Streams TTS to speakers and accepts STT from microphone or audio file. Use when the user says "speak", "say", "transcribe", or wants voice output for an agent reply.
metadata: {"openclaw":{"skillKey":"voice-nova"}}
---

# Voice Nova

Use this skill when the user wants the agent to talk back, read out a message, or transcribe an audio clip.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "speak",
      "say it",
      "read it out",
      "voice reply",
      "talk to me",
      "transcribe",
      "luister",
      "spreek",
      "zeg het",
      "lees voor"
    ]
  },
  "movement": {
    "target": "coffee_machine",
    "skipIfAlreadyThere": true
  }
}
```

When activated, the agent walks to the coffee machine — Nova's signal that voice mode is live.

## Endpoints

VibeVoice Bridge (REST + WS): `http://127.0.0.1:8094`

- `GET /health` — bridge liveness
- `POST /tts` — body `{ "text": "...", "voice": "nova", "stream": true }` → returns audio stream or 200 with audio file path
- `POST /stt` — body multipart form with `audio` file → returns `{ "text": "..." }`
- `WS /tts/stream` — streaming TTS (lowest latency)

Direct VibeVoice TTS (raw): `http://127.0.0.1:8093`

## Workflow

### TTS (agent → speaker)

1. Confirm bridge is up via `GET /health`.
2. POST `/tts` with the agent's reply text and `voice: "nova"`.
3. If the request is interactive, prefer streaming via WS `/tts/stream`.
4. The bridge writes to default audio output; report the duration in the agent reply.

### STT (microphone → agent)

1. The Telegram miniapp or desktop client uploads audio to `/stt`.
2. Receive `{ text }` and treat that text as the user message.
3. If transcription confidence is low, ask user to repeat.

## Voice profile

- Default voice: `nova` (Microsoft VibeVoice-Realtime-0.5B).
- Personality: warm, direct, concise. No filler words.
- Language: auto-detect; explicitly support Dutch and English.

## Response rules

- For TTS, do not also print the spoken text unless user asked for both.
- For STT, repeat the transcription before acting on it (one-line confirmation).
- Never play voice output longer than 60s without offering a "stop" affordance.
- If the bridge is down, fall back to text and tell the user voice is offline.

## Integration

- The voice loop service `novamaster-voice.service` already runs full STT→Ollama→TTS pipeline triggered by "hey jarvis".
- This skill is for ad-hoc voice output, not the always-on loop.
