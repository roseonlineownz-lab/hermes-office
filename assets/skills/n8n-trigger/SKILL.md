---
name: n8n-trigger
description: Inspect n8n workflows and safely dispatch only approved webhooks, with receipts.
metadata: {"openclaw":{"skillKey":"n8n-trigger"}}
---

# n8n integration for Hermes Office

Use this skill when a user asks to inspect workflow status, recent executions, or run an approved n8n automation.

## Ownership and ports

- n8n API: `http://127.0.0.1:5678/api/v1` **from the n8n host**, or the specifically configured internal n8n URL.
- Agent OS is the cockpit on **3737**, not 3000. Check its `/api/n8n/status` and `/api/orchestration/status` for shared readiness.
- AgentBus/EventBus owns task identity and receipts. All dispatches must carry the same `task_id` as Jarvis and StarNet.
- Access from mobile requires a secured HTTPS hostname/tunnel, not `127.0.0.1` in the phone browser.

## Read-only discovery

1. Verify `GET /healthz` and `GET /healthz/readiness` before assuming n8n is operational.
2. Use the official n8n public API `GET /api/v1/workflows?limit=100` with a securely configured `X-N8N-API-KEY` header. Never print or copy credential values into chat, logs, reports or source control.
3. Treat a missing/expired key as **inventory unknown**, not as zero workflows or n8n offline.
4. The API is paginated; follow `nextCursor` if a complete list is needed. For a quick check, explicitly label the first page partial.
5. For recent executions use authenticated `GET /api/v1/executions?workflowId=...` with a bounded result limit, and report only the verified execution ID, outcome and receipt link.

## Approved trigger rule

A workflow **ID is not a webhook path**. Never guess `/webhook/<workflow-id>` or rely on the legacy/unverified `POST /workflows/<id>/run` shortcut.

- Identify the exact workflow by API result, inspect its trigger node and registered webhook path.
- Require the operator-approved workflow and payload, with a documented explicit webhook path.
- Only send a request to the configured workflow endpoint; do not route arbitrary text to a URL or allow an agent to pick a path.
- Use the webhook's configured authentication, idempotency/receipt handling and request timeout. Do not activate or deactivate workflows as part of a status query.
- For destructive, external publishing, payment, credential, deploy, filesystem write or paid model tasks, obtain explicit user approval before triggering. A background agent cannot self-approve.

## Execution proof

Report a real n8n execution ID **only after** the execution API confirms it. HTTP 200/202 from a webhook confirms delivery/acknowledgment, not successful downstream execution. Preserve the `task_id`, timestamp, target lane, approval source, event ID, completion status, and durable receipt reference.

If host routing, API access, webhook credential or approval cannot be verified: **do not execute**. Surface the blocker and show the expected next step.

## Suggested NovaMaster lanes

- Lead Machine events: EventBus 5670 plus n8n 5678, correlated with `task_id`.
- CrewAI: 8135 for specialist research teams.
- LangGraph: 8127/8128 for stateful execution, with policy and receipt gates.
- Hermes: conversational control and human approval.
- Jarvis/RACK/StarNet: visualize evidence; UI alone does not imply an agent is working.

Keep the existing n8n service and any live workflows unchanged when applying this skill update.
