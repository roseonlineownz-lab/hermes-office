---
name: clawmem-search
description: Search ClawMem agent memory for related context, prior decisions, and past conversations. Hybrid search across memory entries with vector + graph traversal. Use when the user references past work, asks "what did we decide", or needs context from previous sessions.
metadata: {"openclaw":{"skillKey":"clawmem-search"}}
---

# ClawMem Search

Use this skill to retrieve context from agent memory before answering questions that depend on prior decisions, past work, or accumulated knowledge.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "remember",
      "recall",
      "search memory",
      "what did we decide",
      "past context",
      "prior conversation",
      "look up in memory",
      "find in memory",
      "earlier we",
      "vorige keer"
    ]
  },
  "movement": {
    "target": "bookshelf",
    "skipIfAlreadyThere": true
  }
}
```

When activated, the agent walks to the bookshelf to consult ClawMem.

## Endpoint

ClawMem REST API: `http://127.0.0.1:7438`

Key endpoints:

- `GET /health` — service liveness
- `POST /search` — hybrid search (vector + lexical)
- `POST /retrieve` — fetch by id with related context
- `GET /timeline` — chronological feed of memory events
- `POST /find_similar` — semantic neighbors of a memory id

## Workflow

1. Hit `GET /health` to confirm service is live. If unreachable, fall back to local file memory and warn user.
2. Construct a search query that captures the user's intent: short, content-rich phrase. Avoid filler words.
3. POST `/search` with body:

   ```json
   {
     "query": "<3-7 token query>",
     "limit": 5,
     "collection": "novamaster-office",
     "min_score": 0.45
   }
   ```

4. If results are weak, retry with `collection: "hermes-agent"` (broader scope) or `collection: "voice-assistant"`.
5. For each hit, optionally call `/retrieve` to expand surrounding context.
6. Cite the memory ids in the response so the user can audit.

## Response rules

- Always say which collection was searched.
- Surface the top 3 hits as a short bulleted list with id, snippet, and timestamp.
- If results conflict with current code/config state, trust current state and flag the stale memory for forget/update.
- Never invent memory entries; only quote what the API returned.

## Collections

- `hermes-agent` — Hermes runtime activity (754+ docs)
- `hermes-home` — broader workspace (1847+ docs)
- `voice-assistant` — voice-loop transcripts
- `novamaster-office` — office-specific decisions

## Failure handling

- If `/search` returns 5xx, retry once after 2s with reduced limit.
- If timeout (>5s), give up and answer from current context only.
- Never block the user response on memory; memory enriches but does not gate.
