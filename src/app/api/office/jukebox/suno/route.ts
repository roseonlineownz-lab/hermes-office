import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SUNO_API_BASE = (process.env.SUNO_API_BASE || "https://api.sunoapi.org").replace(/\/$/, "");
const SUNO_MODEL = process.env.SUNO_MODEL || "chirp-v3-5";

const getSunoApiKey = () => (process.env.SUNO_API_KEY || process.env.SUNOAPI_API_KEY || "").trim();

const buildHeaders = () => {
  const apiKey = getSunoApiKey();
  return {
    "content-type": "application/json",
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  };
};

type SunoGenerateRequest = {
  prompt?: string;
  tags?: string;
  makeInstrumental?: boolean;
  make_instrumental?: boolean;
};

const cleanText = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : fallback;

export async function GET() {
  const configured = Boolean(getSunoApiKey());
  return NextResponse.json({
    ok: true,
    provider: "suno",
    configured,
    baseUrl: SUNO_API_BASE.replace(/^https?:\/\//, ""),
    model: SUNO_MODEL,
    actions: ["generate", "status"],
  });
}

export async function POST(request: Request) {
  const apiKey = getSunoApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "SUNO_API_KEY is not configured for Office jukebox generation." },
      { status: 503 },
    );
  }

  let body: SunoGenerateRequest;
  try {
    body = (await request.json()) as SunoGenerateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const prompt = cleanText(body.prompt);
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt is required." }, { status: 400 });
  }

  const tags = cleanText(body.tags, "office jukebox, electronic, cinematic, instrumental");
  const makeInstrumental = body.makeInstrumental ?? body.make_instrumental ?? true;

  const response = await fetch(`${SUNO_API_BASE}/api/generate`, {
    method: "POST",
    cache: "no-store",
    headers: buildHeaders(),
    body: JSON.stringify({
      prompt,
      tags,
      make_instrumental: makeInstrumental,
      mv: SUNO_MODEL,
    }),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: "Suno generation request failed.", status: response.status, payload },
      { status: response.status },
    );
  }

  return NextResponse.json({
    ok: true,
    provider: "suno",
    queued: true,
    prompt,
    tags,
    model: SUNO_MODEL,
    payload,
  });
}
