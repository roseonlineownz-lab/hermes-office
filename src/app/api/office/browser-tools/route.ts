import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CDP_URL = process.env.HERMES_BROWSER_CDP_URL ?? "http://127.0.0.1:9222";

const commandExists = async (path: string) => {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

export async function GET() {
  let browser: Record<string, unknown> = {
    ok: false,
    cdpUrl: CDP_URL,
  };

  try {
    const response = await fetch(`${CDP_URL.replace(/\/$/, "")}/json/version`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    const payload = (await response.json()) as Record<string, unknown>;
    browser = {
      ok: response.ok,
      cdpUrl: CDP_URL,
      browser: typeof payload.Browser === "string" ? payload.Browser : null,
      protocol: typeof payload["Protocol-Version"] === "string" ? payload["Protocol-Version"] : null,
    };
  } catch (error) {
    browser = {
      ok: false,
      cdpUrl: CDP_URL,
      error: error instanceof Error ? error.message : "CDP probe failed",
    };
  }

  const [computerUse, crawl4ai] = await Promise.all([
    commandExists("/home/faramix/bin/nova-computer-use"),
    commandExists("/home/faramix/bin/faramix-crawl4ai-leads"),
  ]);

  return NextResponse.json({
    ok: true,
    browser,
    tools: {
      computerUse,
      crawl4ai,
    },
  });
}
