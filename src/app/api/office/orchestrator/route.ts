import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CLAW3D_BACKEND_URL = (
  process.env.CLAW3D_BACKEND_URL ??
  process.env.NEXT_PUBLIC_CLAW3D_BACKEND_URL ??
  "http://127.0.0.1:8095"
).replace(/\/$/, "");

const allowedActions = new Set([
  "triage",
  "tick",
  "comment",
  "block",
  "retry",
  "complete",
  "artifact",
  "assign",
  "decompose",
]);

const proxyJson = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${CLAW3D_BACKEND_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text || response.statusText };
  }
  return NextResponse.json(payload, { status: response.status });
};

const cleanTaskId = (value: string | null) => (value ?? "").trim();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const taskId = cleanTaskId(url.searchParams.get("taskId"));
  const report = (url.searchParams.get("report") ?? "").trim();
  if (report === "duplicates") {
    return proxyJson("/kanban/orchestrator/duplicates");
  }
  if (taskId) {
    return proxyJson(`/kanban/orchestrator/${encodeURIComponent(taskId)}`);
  }
  return proxyJson("/kanban/orchestrator");
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = (url.searchParams.get("action") ?? "tick").trim();
  const taskId = cleanTaskId(url.searchParams.get("taskId"));
  if (!allowedActions.has(action)) {
    return NextResponse.json({ error: "Unsupported orchestrator action." }, { status: 400 });
  }

  const body = await request.text();
  const init: RequestInit = {
    method: "POST",
    body: body || "{}",
  };

  if (action === "triage") return proxyJson("/kanban/orchestrator/triage", init);
  if (action === "tick") return proxyJson("/kanban/orchestrator/tick", init);

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required for this action." }, { status: 400 });
  }
  return proxyJson(`/kanban/orchestrator/${encodeURIComponent(taskId)}/${action}`, init);
}
