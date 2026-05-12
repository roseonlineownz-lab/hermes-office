# Claw3D Office Robustness & Stability Spec

## Current State

### What works
- Security hardening is active: strict CSP, no `file://`, no `hermes-desktop://`, no `browsing-topics`, `X-Frame-Options: SAMEORIGIN`, and restrictive `Permissions-Policy`.
- Gateway browser connection has reconnect/backoff behavior and status tracking.
- Gateway adapter startup hardening includes zombie-port cleanup and fallback port handling.
- Server-side runtime/custom proxy path has URL normalization and allowlist enforcement.
- Office service responds at `http://localhost:9120/office` with HTTP 200.
- Verification gates pass: `npm run typecheck`, `npm run lint`, `npm run test -- --run`, and `npm run build`.
- Unit suite currently covers 171 test files / 1078 tests.

### Still weak / future work
1. **No full runtime health dashboard** — operational visibility can still be improved beyond the existing API/service probes.
2. **STUDIO_ACCESS_TOKEN stored plaintext** — local dev acceptable, but not ideal for hardened deployment.
3. **Structured logging remains partial** — logs still mix framework output and app-specific warnings.
4. **UI/AION visual changes are large** — keep visual redesign work isolated from runtime/security commits.
5. **Production security pass should revisit framing policy** — CSP `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` are aligned now, but embedded desktop/webview requirements should be tested explicitly if needed.

## Desired State

### Priority 1: Runtime correctness
- `/office` consistently returns HTTP 200 after service restart.
- CSP retains `'wasm-unsafe-eval'` for browser WASM compatibility.
- Bad header regressions stay blocked: no `file://`, no `hermes-desktop://`, no `browsing-topics`, no `ALLOWALL`.

### Priority 2: Resilience
- Gateway reconnect behavior remains user-visible and bounded.
- Adapter startup handles stale port holders before binding.
- Fallback ports and gateway status are visible in UI without crashing render paths.

### Priority 3: Observability
- Health endpoint should expose office, gateway, adapter, and configured runtime status.
- HUD should present degraded/offline states without implying full failure.
- Logs should be structured enough to isolate service, proxy, and UI runtime faults.

### Priority 4: Security hardening phase 2
- Token encryption at rest or keychain-backed storage for non-local deployments.
- Review cookie flags if auth moves from header/token to cookies.
- Error message sanitization for production-facing deployments.

## Acceptance Criteria
- [x] `npm run typecheck` passes.
- [x] `npm run lint` passes.
- [x] `npm run test -- --run` passes.
- [x] `npm run build` passes.
- [x] `/office` returns HTTP 200.
- [x] CSP includes `'wasm-unsafe-eval'`.
- [x] `file://`, `hermes-desktop://`, `browsing-topics`, and `ALLOWALL` are absent from response headers.
- [ ] UI/AION redesign is either committed separately after review or reverted before push.

## Non-goals
- Adding new product features.
- Mixing visual redesign with security/startup hardening commits.
- Committing runtime state, logs, `.env`, or local storage artifacts.
