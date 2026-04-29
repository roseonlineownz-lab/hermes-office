---
name: jina-read
description: Convert any URL into LLM-friendly markdown via Jina Reader. Strips ads/nav, returns clean text with title, links, and structured headings. Use when an agent needs to read a webpage, extract article content, or summarize external docs.
metadata: {"openclaw":{"skillKey":"jina-read"}}
---

# Jina Read

Use this skill when the user asks the agent to read a URL, summarize a webpage, extract content from a link, or do RAG over external documentation.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "read this url",
      "read this page",
      "summarize this link",
      "fetch this article",
      "scrape this",
      "lees deze pagina",
      "samenvatting van deze link",
      "open de link",
      "fetch markdown of"
    ]
  },
  "movement": {
    "target": "bookshelf",
    "skipIfAlreadyThere": true
  }
}
```

When activated, the agent walks to the bookshelf to read.

## Endpoint

**Public (default)**: prepend `https://r.jina.ai/` to any URL. No auth required for the free tier.

```
GET https://r.jina.ai/<full-url-incl-protocol>
```

**Self-hosted (optional)**: if `JINA_READER_URL` env is set (e.g. `http://127.0.0.1:7430`), use that instead. The repo lives at `/home/faramix/jina-reader/` (cloned, not yet built — needs MongoDB + MinIO via `docker-compose up`).

## Workflow

1. Validate the URL: must start with `http://` or `https://`.
2. Construct the proxy URL:
   - Public: `https://r.jina.ai/<url>`
   - Self-hosted: `${JINA_READER_URL}/<url>`
3. GET with header `Accept: text/markdown` for clean output.
4. Optional headers:
   - `X-Return-Format: markdown` (default), `text`, `screenshot`, `html`, or `pageshot`
   - `X-Target-Selector: article` to scope to a specific element
   - `X-With-Generated-Alt: true` for image alt-text via vision
   - `X-With-Links-Summary: true` for end-of-page link list
   - `X-Token-Budget: 4000` to cap response length
5. Return the markdown to the agent. Cite the source URL in the response.

## Search variant

For web *search* instead of reading a known URL:

```
GET https://s.jina.ai/<url-encoded-query>
```

Returns a list of relevant URLs with snippets, also as markdown.

## Response rules

- Always cite the source URL in the agent's reply.
- For long pages, ask the user if they want a summary or the full markdown.
- If the URL is paywalled or returns 403, surface that fact instead of inventing content.
- Don't read the same URL twice in a single conversation unless the user asks to refresh.

## Failure handling

- 429 rate limit: back off 30s, then retry once. After second 429, suggest configuring `JINA_API_KEY` for higher tier.
- 5xx upstream: try once more after 5s; if still failing, fall back to plain `fetch` and a heuristic HTML→text strip.
- Network error: report URL unreachable, do not retry indefinitely.

## Pairing with other skills

- After reading, hand off to `clawmem-search` to check if the same content was previously indexed.
- For multi-page sites, queue follow-up reads via `n8n-trigger` (workflow with link list).
- For heavy summarization, route to a high-context model via the gateway.
