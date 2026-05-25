import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const fetchJson = async (
  url: string,
  ms = 4_000,
): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> => {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(ms),
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { textPreview: text.slice(0, 200) };
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const execJson = async (command: string, args: string[], timeout = 6_000) => {
  try {
    const result = await execFileAsync(command, args, {
      timeout,
      maxBuffer: 256 * 1024,
    });
    try {
      return {
        ok: true,
        exitCode: 0,
        data: JSON.parse(result.stdout || "null") as unknown,
        stderrPresent: Boolean(result.stderr.trim()),
      };
    } catch {
      return {
        ok: false,
        exitCode: 0,
        data: null,
        parseError: true,
        stderrPresent: Boolean(result.stderr.trim()),
      };
    }
  } catch (error) {
    const maybe = error as { code?: number; stderr?: string; message?: string };
    return {
      ok: false,
      exitCode: typeof maybe.code === "number" ? maybe.code : null,
      data: null,
      error: maybe.message ?? String(error),
      stderrPresent: Boolean(maybe.stderr?.trim()),
    };
  }
};

const execText = async (command: string, args: string[], timeout = 3_000) => {
  try {
    const result = await execFileAsync(command, args, {
      timeout,
      maxBuffer: 64 * 1024,
    });
    return {
      ok: true,
      exitCode: 0,
      stdout: result.stdout.trim(),
      stderrPresent: Boolean(result.stderr.trim()),
    };
  } catch (error) {
    const maybe = error as { code?: number; stderr?: string; stdout?: string; message?: string };
    return {
      ok: false,
      exitCode: typeof maybe.code === "number" ? maybe.code : null,
      stdout: maybe.stdout?.trim() ?? "",
      error: maybe.message ?? String(error),
      stderrPresent: Boolean(maybe.stderr?.trim()),
    };
  }
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export async function GET() {
  const cdpPort = process.env.NOVA_CLOAKBROWSER_CDP_PORT?.trim() || "19222";
  const officeBase = process.env.NOVA_OFFICE_URL?.trim() || "http://127.0.0.1:9120";
  const cdpBase = `http://127.0.0.1:${cdpPort}`;

  const [computer, cloakService, cdpVersion, cdpTabs, officeHealth, officeStudio] = await Promise.all([
    execJson("/home/faramix/bin/nova-computer", ["health"]),
    execText("systemctl", ["--user", "is-active", "nova-cloakserve.service"]),
    fetchJson(`${cdpBase}/json/version`),
    fetchJson(`${cdpBase}/json/list`),
    fetchJson(`${officeBase}/api/health`),
    fetchJson(`${officeBase}/api/studio`),
  ]);

  const computerData = asRecord(computer.data);
  const cdpData = asRecord(cdpVersion.data);
  const tabs = Array.isArray(cdpTabs.data) ? cdpTabs.data : null;

  const payload = {
    ok: Boolean(computerData.ok) && cdpVersion.ok && officeHealth.ok,
    checkedAt: new Date().toISOString(),
    secretsPrinted: false,
    routes: {
      computerHealth: "/home/faramix/bin/nova-computer health",
      computerDoctor: "/home/faramix/bin/nova-computer-doctor",
      cloakbrowserCdp: `${cdpBase}/json/version`,
      officeHealth: `${officeBase}/api/health`,
      officeStudio: `${officeBase}/api/studio`,
    },
    computerUse: {
      ok: Boolean(computerData.ok),
      bridge: typeof computerData.bridge === "string" ? computerData.bridge : null,
      screenPresent: Boolean(computerData.screen),
      mousePresent: Boolean(computerData.mouse),
      exitCode: computer.exitCode,
      stderrPresent: computer.stderrPresent,
    },
    cloakbrowser: {
      serviceActive: cloakService.stdout === "active",
      serviceExitCode: cloakService.exitCode,
      cdpOk: cdpVersion.ok,
      cdpStatus: cdpVersion.status ?? null,
      browser: typeof cdpData.Browser === "string" ? cdpData.Browser : null,
      protocolVersion:
        typeof cdpData["Protocol-Version"] === "string" ? cdpData["Protocol-Version"] : null,
      tabCount: tabs?.length ?? null,
    },
    office: {
      healthOk: officeHealth.ok,
      healthStatus: officeHealth.status ?? null,
      studioOk: officeStudio.ok,
      studioStatus: officeStudio.status ?? null,
    },
  };

  return NextResponse.json(payload, {
    status: payload.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
