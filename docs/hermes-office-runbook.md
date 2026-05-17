# Hermes Office (Claw3D) Runtime Runbook

Dit is de operationele runbook voor snelle check-ins, incident-diagnose en regressievalidatie.

## 1) Wat dit project doet (korte kern)

- Hermes Office/Claw3D is een **gateway-first** visualisatielaag.
- De browser spreekt met Studio (`/api/gateway/ws`, `/api/studio`), Studio praat met de gateway.
- Runtime state, sessions en agent events leven upstream (OpenClaw/Hermes/Hub); Studio beheert vooral UI-settings (gateway URL, token, layout).
- Daarom debuggen we meestal eerst Studio en proxy-lagen voordat we UI rendering of client state fixen.

## 2) Kernbestanden

- [server/studio-settings.js](/home/faramix/.hermes/hermes-office/server/studio-settings.js)
- [server/gateway-proxy.js](/home/faramix/.hermes/hermes-office/server/gateway-proxy.js)
- [src/lib/gateway/GatewayClient.ts](/home/faramix/.hermes/hermes-office/src/lib/gateway/GatewayClient.ts)
- [src/features/retro-office/RetroOffice3D.tsx](/home/faramix/.hermes/hermes-office/src/features/retro-office/RetroOffice3D.tsx)
- [src/features/office/screens/OfficeScreen.tsx](/home/faramix/.hermes/hermes-office/src/features/office/screens/OfficeScreen.tsx)
- [src/features/office/screens/officeScreenHelpers.ts](/home/faramix/.hermes/hermes-office/src/features/office/screens/officeScreenHelpers.ts)

## 3) Dagelijkse quick-check (5–10 min)

1. Service + process

```bash
systemctl --user is-active hermes-office-dev.service
systemctl --user show -p MainPID,SubState hermes-office-dev.service --no-pager
```

2. Config sanity (geen secrets loggen)

```bash
rg -n '^CLAW3D_GATEWAY_URL|^NEXT_PUBLIC_GATEWAY_URL|^STUDIO_ACCESS_TOKEN|^CLAW3D_GATEWAY_ADAPTER_TYPE' \
  /home/faramix/.config/novamaster/hermes-office.env
```

3. Studio API reachability

```bash
curl -sI http://127.0.0.1:9120/api/studio
curl -sS http://127.0.0.1:9120/api/studio | head -c 220
```

4. Health checks (upstream gateway)

```bash
curl -sS http://127.0.0.1:18793/health
curl -sS http://127.0.0.1:18800/health || true
```

5. 15–60s runtime capture

```bash
python3 /tmp/hermes-office-console-capture.py
# of:
python3 /tmp/hermes-office-60s-diagnostic.py
```

6. Log smoke in laatste 5 min

```bash
journalctl --user -u hermes-office-dev.service --since "5 min ago" --no-pager | \
  rg -i "Maximum update depth|ReferenceError|Uncaught|Gateway closed|1006|WebGL context|error|failed" || true
```

### Snelle alles-in-één smoke check (1 min)

```bash
# Hermes Office stability check
python3 /tmp/hermes-office-console-capture.py && \
journalctl --user -u hermes-office-dev.service --since "2 min ago" --no-pager | \
  rg -i "Maximum update depth|ReferenceError|Gateway closed|1006|WebGL context|error|failed" || true

# NovaMaster Kaggle/Colab check
cd /home/faramix/work/NovaMaster && ./scripts/smoke_kaggle_colab.sh
```

**Verwacht resultaat:**
- Hermes: `MAX_DEPTH: 0`, geen `Maximum update depth exceeded` of `ReferenceError`
- NovaMaster: alle checks `PASS`

## 4) Pass-fail criteria

### Pass
- Geen `Maximum update depth exceeded`.
- Geen `ReferenceError` (met name `disableRetroSyncArrival` / `debugRetroSyncArrival`).
- Geen continue `maximum update`-burst in capture/events.
- `/api/studio` geeft 200.
- `hermes-office-dev.service` is actief en stabiel.

### Fail / escalatie
- `Maximum update depth exceeded` in recent logs: loop in UI-state path.
- Capture toont `ReferenceError`: ontbrekende symbolen of niet-gedefinieerde flags.
- Herhaalde `Gateway closed (1006)`/`Gateway is not connected`: traceer upstream gateway/proxy/auth path.
- Continu `WebGL context lost` zonder herstel: controleer context handlers in `RetroOffice3D.tsx`.

## 5) Gericht incident-procedure

## 5.1) /office toont loop-fouten

1. Herstart service:
   ```bash
   systemctl --user restart hermes-office-dev.service
   ```
2. 60s capture draaien (`/tmp/hermes-office-60s-diagnostic.py` of `/tmp/hermes-office-console-capture.py`).
3. Log scan met patronen uit sectie 6.
4. Focus op:
   - `src/features/retro-office/RetroOffice3D.tsx` (state guards + WebGL handlers)
   - `src/features/office/screens/OfficeScreen.tsx` (text-message fingerprint/dependency stabilisatie)

## 5.2) Gateway connectieproblemen

1. Check dat Studio settings een geldig token/pad aangeven (poort klopt met actieve socket):
   - `ss -ltnp | rg ':(18793|18800|18789|8095|8097)\\b'`
2. Check upstream gateway health (waar `18793` hierboven actief blijkt).
3. Zoek proxy-log:
   ```bash
   journalctl --user -u hermes-office-dev.service --since "10 min ago" --no-pager | rg -i "gateway-proxy|upstream|connect|close|openclaw|connect.failed|challenge"
   ```
4. Controleer dat Studio settings en runtime URL in `/api/studio` overeenkomen met actieve poort.

## 6) Log-patterns (copy/paste)

```text
Maximum update depth exceeded
ReferenceError
Uncaught
Gateway closed
1006
WebGL context lost
WebGL context restored
studio access token required
studio gateway url
upstream open url
connect.challenge
```

## 6.1) Kaggle/Colab operational assets

- [Kaggle/Colab inventory + smoke checks](/home/faramix/work/NovaMaster/docs/kaggle_colab_inventory.md)

## 7) Commitstatus rond render-stability (reference)

Recente stabiliteitsfixen zitten in commit:
- `453df59`  
  - `Maximum update depth exceeded` guards
- `WebGL context loss` dedupe/idempotente handlers
- `OfficeScreen` tekst-message fingerprint+guards
- nieuwe unit/E2E regressietests toegevoegd

Gebruik voor validatie:

```bash
git log --oneline -n 5
git status --short
```

## 8) Test suite (relevant)

### Unit
```bash
npm run test -- tests/unit/retroOffice3D.syncArrivalState.test.ts tests/unit/officeScreen.textMessageFingerprint.test.ts tests/unit/officeScreen.setPreparedTextMessagesByAgentId.test.ts
```

### E2E
```bash
npm run e2e -- tests/e2e/office-maximum-update-depth.spec.ts tests/e2e/office-screen-text-message-stability.spec.ts
```

> Tip: tijdens snelle checks liever eerst `npm run e2e -- <file>` voor de specifieke regressiefile.

## 9) Security / privacy

- Nooit tokenwaarden of raw cookie waarde loggen.
- Tokenchecks alleen op aanwezigheid/metadata:
  - lengte
  - SHA256-prefix
