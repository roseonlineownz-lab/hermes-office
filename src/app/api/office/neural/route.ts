import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { NOVA_IDENTITIES, resolveNovaIdentity } from "@/lib/identity/novaIdentities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAW3D_BACKEND_URL = (
  process.env.CLAW3D_BACKEND_URL ??
  process.env.NEXT_PUBLIC_CLAW3D_BACKEND_URL ??
  "http://127.0.0.1:8095"
).replace(/\/$/, "");
const OFFICE_ADAPTER_URL = (process.env.HERMES_OFFICE_ADAPTER_URL ?? "http://127.0.0.1:18800").replace(/\/$/, "");
const RECEIPT_DIR =
  process.env.NOVAMASTER_RECEIPT_DIR ??
  "/home/faramix/.cache/clawmem/novamaster-receipts";
const ACTION_LOG = join(RECEIPT_DIR, "actions", "office-actions.jsonl");

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const compact = (value: string | null | undefined, max = 180) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

const fetchJson = async (url: string) => {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2500) });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
    return { ok: response.ok, status: response.status, payload, url };
  } catch (error) {
    return { ok: false, status: 0, payload: null, url, error: error instanceof Error ? error.message : "unreachable" };
  }
};

type NeuralNode = {
  id: string;
  label: string;
  kind: "agent" | "system" | "room" | "task";
  status: string;
  color: string;
  subtitle?: string | null;
  model?: string | null;
  room?: string | null;
  progress?: number | null;
  source: string[];
  lastSeen?: string | null;
};

type NeuralEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "message" | "task" | "event" | "action" | "health";
  time?: string | null;
  intensity: number;
};

type NeuralMessage = {
  id: string;
  time: string | null;
  from: string;
  to: string;
  kind: "action" | "event" | "task" | "health";
  text: string;
  status?: string | null;
  source: string;
};

const readJsonlTail = async (path: string, limit: number): Promise<Record<string, unknown>[]> => {
  try {
    const raw = await readFile(path, "utf8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  } catch {
    return [];
  }
};

const todayEventLog = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return join(RECEIPT_DIR, "events", `${day}-nova-events.jsonl`);
};

const addNode = (nodes: Map<string, NeuralNode>, node: NeuralNode) => {
  const existing = nodes.get(node.id);
  if (!existing) {
    nodes.set(node.id, node);
    return;
  }
  nodes.set(node.id, {
    ...existing,
    ...node,
    source: Array.from(new Set([...existing.source, ...node.source])),
    subtitle: node.subtitle ?? existing.subtitle,
    model: node.model ?? existing.model,
    room: node.room ?? existing.room,
    progress: node.progress ?? existing.progress,
    lastSeen: node.lastSeen ?? existing.lastSeen,
  });
};

const addIdentityNode = (nodes: Map<string, NeuralNode>, id: string, source: string[] = ["identity-registry"]) => {
  const identity = resolveNovaIdentity(id);
  addNode(nodes, {
    id: identity.id,
    label: identity.label,
    kind: "agent",
    status: "known",
    color: identity.color,
    subtitle: `pet ${identity.pet} · voice ${identity.voiceProfile}`,
    source,
  });
  return identity;
};

export async function GET() {
  const [health, agents, orchestrator, adapter] = await Promise.all([
    fetchJson(`${CLAW3D_BACKEND_URL}/health`),
    fetchJson(`${CLAW3D_BACKEND_URL}/agents`),
    fetchJson(`${CLAW3D_BACKEND_URL}/kanban/orchestrator`),
    fetchJson(`${OFFICE_ADAPTER_URL}/health`),
  ]);
  const [actions, novaEvents] = await Promise.all([
    readJsonlTail(ACTION_LOG, 24),
    readJsonlTail(todayEventLog(), 24),
  ]);

  const nodes = new Map<string, NeuralNode>();
  const edges: NeuralEdge[] = [];
  const messages: NeuralMessage[] = [];

  Object.keys(NOVA_IDENTITIES).forEach((id) => addIdentityNode(nodes, id));

  addNode(nodes, {
    id: "claw3d-backend",
    label: "Claw3D Backend",
    kind: "system",
    status: health.ok ? "online" : "offline",
    color: health.ok ? "#38bdf8" : "#ef4444",
    subtitle: `${CLAW3D_BACKEND_URL} · HTTP ${health.status || "down"}`,
    source: ["backend-health"],
  });
  addNode(nodes, {
    id: "office-adapter",
    label: "Office Adapter",
    kind: "system",
    status: adapter.ok ? "online" : "offline",
    color: adapter.ok ? "#22c55e" : "#ef4444",
    subtitle: `${OFFICE_ADAPTER_URL} · HTTP ${adapter.status || "down"}`,
    source: ["adapter-health"],
  });
  edges.push({ id: "health-backend-office", from: "claw3d-backend", to: "office", label: "health", kind: "health", intensity: health.ok ? 0.7 : 0.25 });
  edges.push({ id: "health-adapter-office", from: "office-adapter", to: "office", label: "gateway", kind: "health", intensity: adapter.ok ? 0.7 : 0.25 });

  const agentPayload = asObject(agents.payload);
  const agentData = asObject(agentPayload.data ?? agentPayload.agents ?? agentPayload);
  for (const [rawId, rawAgent] of Object.entries(agentData)) {
    const value = asObject(rawAgent);
    const identity = addIdentityNode(nodes, rawId, ["claw3d-backend-agents"]);
    const room = asString(value.room);
    const status = asString(value.status) ?? "unknown";
    addNode(nodes, {
      id: identity.id,
      label: asString(value.name) ?? identity.label,
      kind: "agent",
      status,
      color: identity.color,
      subtitle: compact(asString(value.task), 140),
      model: asString(value.model) ?? asString(value.preferred_model),
      room,
      progress: asNumber(value.progress),
      source: ["claw3d-backend-agents"],
    });
    if (room) {
      const roomId = `room:${room}`;
      addNode(nodes, {
        id: roomId,
        label: room.replaceAll("_", " "),
        kind: "room",
        status: "room",
        color: "#475569",
        source: ["agent-room"],
      });
      edges.push({ id: `agent-room-${identity.id}-${room}`, from: identity.id, to: roomId, label: status, kind: "event", intensity: status === "active" ? 0.9 : 0.35 });
    }
  }

  const orchPayload = asObject(orchestrator.payload);
  const summary = asObject(orchPayload.summary);
  const tasks = Array.isArray(orchPayload.tasks) ? orchPayload.tasks.map(asObject) : [];
  const orchEvents = Array.isArray(summary.events) ? summary.events.map(asObject).slice(-18) : [];

  for (const task of tasks.slice(0, 80)) {
    const assigned = asString(task.assigned_agent_id);
    const requester = asString(task.requester) ?? "operator";
    if (!assigned) continue;
    const identity = addIdentityNode(nodes, assigned, ["orchestrator-tasks"]);
    const requesterIdentity = resolveNovaIdentity(requester);
    const taskId = asString(task.id) ?? `task-${messages.length}`;
    const status = asString(task.status) ?? "task";
    const title = compact(asString(task.title), 140) ?? "orchestrator task";
    edges.push({ id: `task-${taskId}`, from: requesterIdentity.id, to: identity.id, label: status, kind: "task", time: asString(task.updated_at), intensity: status === "running" ? 1 : 0.45 });
    messages.push({ id: `task-msg-${taskId}`, time: asString(task.updated_at), from: requesterIdentity.label, to: identity.label, kind: "task", text: title, status, source: "kanban/orchestrator" });
  }

  for (const event of orchEvents) {
    const payload = asObject(event.payload);
    const taskId = asString(payload.task_id) ?? asString(Array.isArray(payload.started) ? payload.started[0] : null);
    const type = asString(event.type) ?? "orchestrator_event";
    const assignedTask = tasks.find((task) => asString(task.id) === taskId);
    const assigned = assignedTask ? asString(assignedTask.assigned_agent_id) : null;
    const identity = addIdentityNode(nodes, assigned ?? type, ["orchestrator-events"]);
    messages.push({ id: `orch-event-${asString(event.id) ?? messages.length}`, time: asString(event.timestamp), from: "Orchestrator", to: identity.label, kind: "event", text: `${type}${taskId ? ` · ${taskId}` : ""}`, status: asString(event.severity), source: "kanban/orchestrator.events" });
  }

  actions.forEach((action, index) => {
    const agent = asString(action.agent) ?? "hermes";
    const identity = addIdentityNode(nodes, agent, ["office-actions"]);
    const status = asString(action.status) ?? "unknown";
    const title = compact(asString(action.title) ?? asString(action.task), 150) ?? "office action";
    const time = asString(action.time) ?? asString(action.ts);
    const actionId = `${asString(action.id) ?? "action"}-${status}-${index}`;
    edges.push({ id: `action-${actionId}`, from: identity.id, to: "office", label: status, kind: "action", time, intensity: status === "running" ? 1 : status === "error" ? 0.9 : 0.55 });
    messages.push({ id: `action-msg-${actionId}-${time ?? ""}`, time, from: identity.label, to: "Claw3D Office", kind: "action", text: title, status, source: ACTION_LOG });
  });

  for (const event of novaEvents) {
    const agent = asString(event.agent) ?? asString(event.source) ?? "office";
    const identity = addIdentityNode(nodes, agent, ["nova-events"]);
    const text = compact(asString(event.message) ?? asString(event.mode), 160) ?? "nova event";
    const time = asString(event.time) ?? asString(event.ts);
    const to = event.eventbus === true ? "claw3d-backend" : event.pet === true ? "openclaw" : "office";
    edges.push({ id: `nova-event-${messages.length}-${time ?? ""}`, from: identity.id, to, label: asString(event.mode) ?? "event", kind: "event", time, intensity: 0.65 });
    messages.push({ id: `nova-event-msg-${messages.length}-${time ?? ""}`, time, from: identity.label, to, kind: "event", text, status: asString(event.mode), source: todayEventLog() });
  }

  const healthPayload = asObject(health.payload);
  const route = asObject(healthPayload.hermes_route);
  const primary = asObject(route.primary);
  if (asString(primary.model)) {
    messages.push({
      id: "health-route",
      time: new Date().toISOString(),
      from: "Hermes route",
      to: "All agents",
      kind: "health",
      text: `${asString(primary.provider) ?? "provider"} · ${asString(primary.model)} · ${primary.degraded === true ? "degraded" : "healthy"}`,
      status: primary.degraded === true ? "degraded" : "healthy",
      source: `${CLAW3D_BACKEND_URL}/health`,
    });
  }

  const sortedMessages = messages
    .sort((a, b) => Date.parse(b.time ?? "") - Date.parse(a.time ?? ""))
    .slice(0, 60);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    sources: {
      backend: { url: health.url, ok: health.ok, status: health.status },
      agents: { url: agents.url, ok: agents.ok, status: agents.status },
      orchestrator: { url: orchestrator.url, ok: orchestrator.ok, status: orchestrator.status },
      adapter: { url: adapter.url, ok: adapter.ok, status: adapter.status },
      actions: ACTION_LOG,
      novaEvents: todayEventLog(),
    },
    summary: {
      nodes: nodes.size,
      edges: edges.length,
      messages: sortedMessages.length,
      activeAgents: Array.from(nodes.values()).filter((node) => node.kind === "agent" && ["active", "running", "known"].includes(node.status)).length,
      activeActions: actions.filter((action) => asString(action.status) === "running").length,
      orchestrator: {
        total: asNumber(summary.total),
        active_count: asNumber(summary.active_count),
        statuses: asObject(summary.statuses),
        updated_at: asString(summary.updated_at),
      },
    },
    nodes: Array.from(nodes.values()),
    edges: edges.slice(-140),
    messages: sortedMessages,
  });
}
