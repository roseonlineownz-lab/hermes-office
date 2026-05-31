type LiveKitEnvInput = {
  envText?: string;
  processEnv?: Record<string, string | undefined>;
};

type LiveKitPrivateEnv = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

export type LiveKitPublicEnv = {
  url: string | null;
  api_key_present: boolean;
  api_secret_present: boolean;
};

export type LiveKitEnvResult = {
  ok: boolean;
  public: LiveKitPublicEnv;
  private: {
    url: string | null;
    apiKey: string | null;
    apiSecret: string | null;
  };
};

function parseEnvText(envText: string | undefined): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (!envText) return parsed;

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return parsed;
}

function firstValue(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function readLiveKitEnv(input: LiveKitEnvInput = {}): LiveKitEnvResult {
  const fileEnv = parseEnvText(input.envText);
  const processEnv = input.processEnv ?? process.env;

  const url = firstValue(fileEnv.LIVEKIT_URL, processEnv.LIVEKIT_URL);
  const apiKey = firstValue(fileEnv.LIVEKIT_API_KEY, processEnv.LIVEKIT_API_KEY);
  const apiSecret = firstValue(fileEnv.LIVEKIT_API_SECRET, processEnv.LIVEKIT_API_SECRET);

  return {
    ok: Boolean(url && apiKey && apiSecret),
    public: {
      url,
      api_key_present: Boolean(apiKey),
      api_secret_present: Boolean(apiSecret),
    },
    private: {
      url,
      apiKey,
      apiSecret,
    },
  };
}

function base64Url(input: string | Buffer): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signHs256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const { createHmac } = await import("crypto");
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const body = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64Url(signature)}`;
}

export async function buildLiveKitConnectionDetails(options: {
  room: string;
  identity: string;
  name?: string;
  ttl?: number;
  env: LiveKitPrivateEnv;
}): Promise<{
  url: string;
  room: string;
  identity: string;
  name?: string;
  token: string;
}> {
  const room = options.room.trim();
  const identity = options.identity.trim();
  if (!room) throw new Error("LiveKit room is required");
  if (!identity) throw new Error("LiveKit identity is required");
  if (!options.env.url || !options.env.apiKey || !options.env.apiSecret) {
    throw new Error("LiveKit credentials are incomplete");
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(60, Math.min(options.ttl ?? 900, 60 * 60));
  const payload = {
    iss: options.env.apiKey,
    sub: identity,
    name: options.name,
    iat: now,
    nbf: now - 5,
    exp: now + ttl,
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    metadata: JSON.stringify({ source: "claw3d-office", room }),
  };

  return {
    url: options.env.url,
    room,
    identity,
    name: options.name,
    token: await signHs256(payload, options.env.apiSecret),
  };
}

export function buildLiveKitPromptPayload(text: string): { type: "prompt"; text: string } {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("LiveKit prompt text is required");
  return { type: "prompt", text: trimmed };
}
