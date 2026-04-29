---
name: comfyui-gen
description: Generate images via ComfyUI. Send a prompt + optional workflow JSON, queue the job, poll until done, and return the image URL. Use when the user asks for an image, picture, render, or visual mockup.
metadata: {"openclaw":{"skillKey":"comfyui-gen"}}
---

# ComfyUI Generate

Use this skill when the user wants an image generated, a logo rendered, or a visual mockup produced.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "generate an image",
      "make a picture",
      "render this",
      "draw",
      "create a logo",
      "comfyui",
      "image of",
      "picture of",
      "maak een plaatje",
      "teken",
      "render"
    ]
  },
  "movement": {
    "target": "whiteboard",
    "skipIfAlreadyThere": true
  }
}
```

When activated, the agent walks to the whiteboard to render visuals.

## Endpoint

ComfyUI: `http://127.0.0.1:8188`

- `GET /system_stats` — liveness + GPU stats
- `POST /prompt` — queue a workflow; body `{ "prompt": <workflow_json>, "client_id": "..." }`
- `GET /queue` — current queue
- `GET /history/{prompt_id}` — execution history with output filenames
- `GET /view?filename=...&type=output` — fetch generated image
- WS `ws://127.0.0.1:8188/ws?clientId=...` — live progress events

## Workflow

1. `GET /system_stats` to confirm service + GPU available.
2. Pick a workflow template (defaults stored at `${OPENCLAW_STATE_DIR}/claw3d/comfyui-gen/workflows/`):
   - `txt2img-sdxl.json` — fast SDXL text-to-image (default)
   - `img2img.json` — input image + prompt
   - `flux-dev.json` — high-quality FLUX render
3. Inject the user's prompt into the `CLIPTextEncode` positive node of the chosen workflow.
4. POST to `/prompt` and capture `prompt_id`.
5. Poll `GET /history/{prompt_id}` every 1.5s until `outputs` is populated, or open the WS for live events.
6. Extract output filename(s) from `outputs.<node_id>.images[0].filename`.
7. Return image URL: `http://127.0.0.1:8188/view?filename=<f>&type=output`.

## Response rules

- Confirm prompt and chosen workflow before queueing.
- Show queue position if the user has to wait >5s.
- Surface the output URL so the office UI can display it on the whiteboard.
- For NSFW or risky prompts, refuse and explain the policy.

## Defaults

- Width/height: 1024x1024
- Steps: 28
- CFG: 7.0
- Sampler: euler
- Seed: random

## Failure handling

- If GPU OOM, retry once with width/height halved.
- If queue >5 jobs deep, ask the user if they want to wait or cancel.
- If model not loaded, surface the model id and suggest `ollama pull` analog or pre-warming.
