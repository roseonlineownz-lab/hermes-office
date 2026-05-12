import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EVENTBUS_URL = process.env.NOVAMASTER_EVENTBUS_URL ?? "http://127.0.0.1:5670/agents";
const TIMEOUT_MS = 1500;

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(EVENTBUS_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`eventbus returned ${res.status}`);
    }

    const data = (await res.json()) as unknown;

    return NextResponse.json(
      {
        ok: true,
        source: "eventbus",
        eventbusUrl: EVENTBUS_URL,
        timestamp: new Date().toISOString(),
        data,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    clearTimeout(timer);

    const message = err instanceof Error ? err.message : String(err);
    const isTimeout =
      err instanceof Error &&
      (message.includes("abort") || message.includes("timeout") || message.includes("Timeout"));

    return NextResponse.json(
      {
        ok: false,
        source: "fallback",
        eventbusUrl: EVENTBUS_URL,
        timestamp: new Date().toISOString(),
        error: isTimeout ? "eventbus timeout" : message,
        data: {},
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
