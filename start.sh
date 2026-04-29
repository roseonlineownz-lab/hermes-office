#!/usr/bin/env bash
# Hermes Office — one-command startup
# Starts all services in order: Ollama → OpenClaw Gateway → Hermes API → Hermes Adapter → Office
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[hermes-office]${NC} $*"; }
warn() { echo -e "${YELLOW}[hermes-office]${NC} $*"; }
err()  { echo -e "${RED}[hermes-office]${NC} $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OFFICE_DIR="$SCRIPT_DIR"
ADAPTER_LOG="/tmp/hermes-adapter.log"
OFFICE_LOG="/tmp/hermes-office.log"

# ── 1. Ollama ──────────────────────────────────────────────────────────────
if ss -tlnp | grep -q ':11441\|:11434'; then
  log "Ollama already running"
else
  log "Starting Ollama..."
  ollama serve &>/dev/null &
  for i in $(seq 1 15); do
    if curl -sf http://127.0.0.1:11434/api/version &>/dev/null; then break; fi
    sleep 1
  done
  if curl -sf http://127.0.0.1:11434/api/version &>/dev/null; then
    log "Ollama ready"
  else
    warn "Ollama not responding after 15s — continuing anyway"
  fi
fi

# ── 2. OpenClaw Gateway ────────────────────────────────────────────────────
if ss -tlnp | grep -q ':18791 '; then
  log "OpenClaw Gateway already running on :18791"
else
  log "Starting OpenClaw Gateway..."
  openclaw gateway start --detach 2>/dev/null || true
  for i in $(seq 1 20); do
    if curl -sf http://127.0.0.1:18791/ &>/dev/null; then break; fi
    sleep 1
  done
  if ss -tlnp | grep -q ':18791 '; then
    log "OpenClaw Gateway ready on :18791"
  else
    warn "OpenClaw Gateway not responding on :18791 — continuing anyway"
  fi
fi

# ── 3. Hermes API ─────────────────────────────────────────────────────────
if ss -tlnp | grep -q ':8642 '; then
  log "Hermes API already running on :8642"
else
  log "Starting Hermes API..."
  hermes api start &>/dev/null || true
  for i in $(seq 1 20); do
    if curl -sf http://127.0.0.1:8642/health &>/dev/null; then break; fi
    sleep 1
  done
  if ss -tlnp | grep -q ':8642 '; then
    log "Hermes API ready on :8642"
  else
    warn "Hermes API not responding on :8642 — continuing anyway"
  fi
fi

# ── 4. Hermes Gateway Adapter ──────────────────────────────────────────────
if ss -tlnp | grep -q ':18789 '; then
  log "Hermes Adapter already running on :18789"
else
  log "Starting Hermes Gateway Adapter..."
  cd "$OFFICE_DIR"
  nohup node server/hermes-gateway-adapter.js > "$ADAPTER_LOG" 2>&1 &
  ADAPTER_PID=$!
  for i in $(seq 1 10); do
    if ss -tlnp | grep -q ':18789 '; then break; fi
    sleep 1
  done
  if ss -tlnp | grep -q ':18789 '; then
    log "Hermes Adapter ready on :18789 (PID $ADAPTER_PID)"
  else
    err "Hermes Adapter failed to start — check $ADAPTER_LOG"
    exit 1
  fi
fi

# ── 5. Claw3D Office (Next.js + Studio Proxy) ─────────────────────────────
if ss -tlnp | grep -q ':3000 '; then
  log "Claw3D Office already running on :3000"
else
  log "Starting Claw3D Office..."
  cd "$OFFICE_DIR"
  # Kill stale server if any
  fuser -k 3000/tcp &>/dev/null || true
  sleep 1
  > "$OFFICE_LOG"
  nohup node server/index.js >> "$OFFICE_LOG" 2>&1 &
  OFFICE_PID=$!
  for i in $(seq 1 15); do
    if curl -sf http://127.0.0.1:3000/ &>/dev/null; then break; fi
    sleep 1
  done
  if curl -sf http://127.0.0.1:3000/ &>/dev/null; then
    log "Claw3D Office ready on :3000 (PID $OFFICE_PID)"
  else
    err "Office failed to start — check $OFFICE_LOG"
    exit 1
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
log "========================================="
log "  Hermes Office Stack is running!"
log "========================================="
echo ""
log "  Office:       http://localhost:3000"
log "  Adapter:      ws://127.0.0.1:18789"
log "  Gateway:      ws://127.0.0.1:18791"
log "  Hermes API:   http://127.0.0.1:8642"
log "  Dashboard:    http://127.0.0.1:9119"
echo ""
log "  Adapter log:  $ADAPTER_LOG"
log "  Office log:   $OFFICE_LOG"
echo ""