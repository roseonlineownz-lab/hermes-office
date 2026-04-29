---
name: n8n-trigger
description: Trigger and monitor n8n workflows from the office. List active workflows, fire webhooks, check executions. Use when the user wants to run an automation, fire a webhook, or inspect workflow status.
metadata: {"openclaw":{"skillKey":"n8n-trigger"}}
---

# n8n Trigger

Use this skill when the user asks to run a workflow, fire an automation, check workflow status, or list available n8n flows.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "run workflow",
      "trigger workflow",
      "fire automation",
      "n8n",
      "list workflows",
      "execute flow",
      "check execution",
      "workflow status",
      "automation status"
    ]
  },
  "movement": {
    "target": "computer",
    "skipIfAlreadyThere": true
  }
}
```

When activated, the agent walks to the workstation computer to interact with n8n.

## Endpoint

n8n REST API: `http://127.0.0.1:5678/api/v1`

Auth: header `X-N8N-API-KEY: <token>` — read token from `~/.n8n/.env` or `OPENCLAW_STATE_DIR/n8n/api-key`.

Key endpoints:

- `GET /workflows?active=true` — list active workflows
- `GET /workflows/{id}` — workflow detail
- `POST /workflows/{id}/activate` / `/deactivate` — toggle workflow
- `GET /executions?workflowId={id}&limit=5` — recent executions
- `POST /webhook/<path>` — fire a webhook trigger (no auth header needed for webhook URLs)

## Workflow

1. List active workflows with `GET /workflows?active=true`.
2. If user names a workflow, match by `name` (case-insensitive, fuzzy).
3. To trigger:
   - **Webhook trigger** → POST to `http://127.0.0.1:5678/webhook/<path>` with the user's payload.
   - **Manual trigger** → call `POST /workflows/{id}/run` (n8n 1.x).
4. Poll `GET /executions?workflowId={id}&limit=1` until `finished=true` or 30s elapsed.
5. Report `status` (success/error), execution id, and `data.resultData` summary.

## Response rules

- Confirm which workflow was triggered with id and name.
- If multiple workflows match the user's request, ask which one before firing.
- Never trigger destructive workflows (delete, drop, force-push) without explicit confirmation.
- Surface execution errors verbatim — do not paraphrase failures.

## Common workflows in this stack

- `lead-enrichment` — process incoming leads
- `daily-digest` — summary email
- `voice-loop` — Telegram voice processing
- `office-checkin` — agent presence updates

## Failure handling

- If 401, refresh API key from env and retry once.
- If 404, list workflows and suggest closest match.
- If webhook target is paused, surface that and offer to activate first.
