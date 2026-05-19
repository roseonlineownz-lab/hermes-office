import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const NOVA_PET = "/home/faramix/bin/nova-pet";

export async function GET() {
  try {
    const { stdout } = await execFileAsync(NOVA_PET, ["status"], {
      timeout: 5_000,
      maxBuffer: 128 * 1024,
      env: {
        ...process.env,
        PATH: `/home/faramix/bin:${process.env.PATH ?? ""}`,
      },
    });
    const payload = JSON.parse(stdout) as Record<string, unknown>;
    return NextResponse.json({
      ok: Boolean(payload.ok),
      source: NOVA_PET,
      ...payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        source: NOVA_PET,
        error: error instanceof Error ? error.message : "nova-pet status failed",
      },
      { status: 200 },
    );
  }
}
