# Computer Use Injection Plan

## Extracted from Hermes Computer Use

Hermes Computer Use brings three useful patterns that should survive outside macOS:

1. Capture before action: every UI task starts from a screenshot or accessibility tree.
2. Element references over pixels: click by ref/index first; only use coordinates for canvas cases.
3. Verify after state changes: every click/type/key/drag needs a follow-up capture or health probe.

The macOS-specific part is `cua-driver`: background click/type/scroll/drag without moving the visible cursor or stealing keyboard focus. That is not the primary NovaMaster path because this stack runs under WSL.

## NovaMaster mapping

| Hermes Computer Use | NovaMaster implementation |
| --- | --- |
| `computer_use(action="capture", mode="som")` | Browser/Playwright snapshot + screenshot when needed |
| Element index targeting | Playwright refs (`@e1`) and accessibility-tree selectors |
| `capture_after=True` | Re-snapshot or HTTP probe after each state-changing action |
| Background native desktop input | Isolated Playwright/Chromium sessions in WSL |
| App-scoped captures | Page/app-scoped browser sessions and local-only routing |
| Destructive action approvals | Existing Hermes approval/Tirith guardrails |

## Current tuned settings

Expected Hermes config posture:

```yaml
browser:
  auto_local_for_private_urls: true
  allow_private_urls: false
  record_sessions: false
  engine: auto
security:
  redact_secrets: true
  tirith_enabled: true
mcp_servers:
  playwright:
    command: npx
    args:
      - --yes
      - '@playwright/mcp@latest'
      - --headless
      - --browser
      - chromium
      - --isolated
      - --no-sandbox
      - --viewport-size
      - 1280x720
      - --image-responses
      - omit
```

## Do not do on WSL

- Do not install macOS `cua-driver`.
- Do not depend on pyautogui-style visible cursor automation.
- Do not enable browser session recording by default.
- Do not send private/local URLs to cloud browser providers.

## Next integration targets

1. Expose Computer Use ops readiness in Office settings.
2. Keep Playwright MCP as the primary execution backend.
3. Add telemetry later: last snapshot, last action, verification result, and approval state.
4. If Windows-native desktop control is required, build a separate Windows bridge instead of forcing macOS tooling into WSL.

## AionUi Remote Agent truth condition

Use this wording in operator docs and status reports:

"Agents zijn klaar voor gebruik zodra ze in AionUi onder Settings → Agents → Remote Agents als Connected staan."

Notes:
- "Test Connection" validates endpoint reachability only.
- Full auth/token/device handshake is confirmed on save + runtime connection state.
- Connected/Pending/Error/Unknown must be checked in AionUi itself for final confirmation.
