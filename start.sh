#!/usr/bin/env bash
# NovaMaster Office — one-command startup
# Starts all services in order with health checks and auto-retry
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[novamaster]${NC} $*"; }
warn() { echo -e "${YELLOW}[novamaster]${NC} $*"; }
err()  { echo -e "${RED}[novamaster]${NC} $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OFFICE_DIR="$SCRIPT_DIR"
ADAPTER_LOG="/tmp/hermes-adapter.log"
OFFICE_LOG="/tmp/hermes-office.log"
COMPOSE_DIR="$HOME/.hermes/docker"

wait_for_http() {
  local name="$1" url="$2" max_wait="${3:-20}"
  for i in $(seq 1 "$max_wait"); do
    if curl -sf --max-time 2 "$url" &>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

wait_for_port() {
  local name="$1" port="$2" max_wait="${3:-15}"
  for i in $(seq 1 "$max_wait"); do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then return 0; fi
    sleep 1
  done
  return 1
}

ensure_running() {
  local name="$1" url="$2" start_cmd="$3"
  if curl -sf --max-time 2 "$url" &>/dev/null; then
    log "$name already running"
  else
    log "Starting $name..."
    eval "$start_cmd"
    if wait_for_http "$name" "$url" 20; then
      log "$name ready"
    else
      warn "$name not responding — continuing anyway"
    fi
  fi
}

# ── 1. Infrastructure (Docker) ──────────────────────────────────────────────
if [[ -d "$COMPOSE_DIR" ]] && [[ -f "$COMPOSE_DIR/docker-compose.yml" ]]; then
  log "Starting Docker infrastructure..."
  cd "$COMPOSE_DIR"
  docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null || true
  cd "$OFFICE_DIR"
fi

# ── 2. Ollama ──────────────────────────────────────────────────────────────
if curl -sf --max-time 2 http://127.0.0.1:11434/api/version &>/dev/null; then
  log "Ollama already running"
else
  log "Starting Ollama..."
  ollama serve &>/dev/null &
  if wait_for_http "Ollama" "http://127.0.0.1:11434/api/version" 15; then
    log "Ollama ready"
  else
    warn "Ollama not responding — continuing anyway"
  fi
fi

# ── 3. OpenClaw Gateway ────────────────────────────────────────────────────
if ss -tlnp 2>/dev/null | grep -q ':18791 '; then
  log "OpenClaw Gateway already running"
else
  log "Starting OpenClaw Gateway..."
  openclaw gateway start --detach 2>/dev/null || true
  if wait_for_port "OpenClaw Gateway" 18791 20; then
    log "OpenClaw Gateway ready"
  else
    warn "OpenClaw Gateway not responding — continuing anyway"
  fi
fi

# ── 4. Hermes API ──────────────────────────────────────────────────────────
if curl -sf --max-time 2 http://127.0.0.1:8642/health &>/dev/null; then
  log "Hermes API already running"
else
  log "Starting Hermes API..."
  hermes api start &>/dev/null || true
  if wait_for_http "Hermes API" "http://127.0.0.1:8642/health" 20; then
    log "Hermes API ready"
  else
    warn "Hermes API not responding — continuing anyway"
  fi
fi

# ── 5. Hermes Gateway Adapter ──────────────────────────────────────────────
if curl -sf --max-time 2 http://127.0.0.1:18789/health &>/dev/null; then
  log "Hermes Adapter already running"
else
  log "Starting Hermes Gateway Adapter..."
  cd "$OFFICE_DIR"
  > "$ADAPTER_LOG"
  nohup node server/hermes-gateway-adapter.js >> "$ADAPTER_LOG" 2>&1 &
  ADAPTER_PID=$!
  if wait_for_http "Hermes Adapter" "http://127.0.0.1:18789/health" 10; then
    log "Hermes Adapter ready (PID $ADAPTER_PID)"
  else
    err "Hermes Adapter failed — check $ADAPTER_LOG"
    exit 1
  fi
fi

# ── 6. NovaMaster Office (Next.js) ─────────────────────────────────────────
if curl -sf --max-time 2 http://127.0.0.1:3000/ &>/dev/null; then
  log "NovaMaster Office already running"
else
  log "Starting NovaMaster Office..."
  cd "$OFFICE_DIR"
  fuser -k 3000/tcp &>/dev/null || true
  sleep 1
  > "$OFFICE_LOG"
  nohup node server/index.js >> "$OFFICE_LOG" 2>&1 &
  OFFICE_PID=$!
  if wait_for_http "Office" "http://127.0.0.1:3000/" 15; then
    log "NovaMaster Office ready (PID $OFFICE_PID)"
  else
    err "Office failed — check $OFFICE_LOG"
    exit 1
  fi
fi

# ── 7. Qdrant ──────────────────────────────────────────────────────────────
if curl -sf --max-time 2 http://127.0.0.1:6333/healthz &>/dev/null; then
  log "Qdrant already running"
else
  log "Starting Qdrant..."
  QDRANT_CONFIG="${QDRANT_CONFIG:-/tmp/qdrant-config.yaml}"
  if [[ -f "$QDRANT_CONFIG" ]]; then
    nohup qdrant --config-path "$QDRANT_CONFIG" &>/dev/null &
  else
    nohup qdrant &>/dev/null &
  fi
  if wait_for_http "Qdrant" "http://127.0.0.1:6333/healthz" 10; then
    log "Qdrant ready"
  else
    warn "Qdrant not responding — continuing anyway"
  fi
fi

# ── 8. JARVIS Bridge ───────────────────────────────────────────────────────
if curl -sf --max-time 2 http://127.0.0.1:7777/health &>/dev/null; then
  log "JARVIS Bridge already running"
else
  if [[ -f "/tmp/jarvis-7777-bridge.py" ]]; then
    log "Starting JARVIS Bridge..."
    nohup python3 /tmp/jarvis-7777-bridge.py &>/dev/null &
    if wait_for_http "JARVIS Bridge" "http://127.0.0.1:7777/health" 10; then
      log "JARVIS Bridge ready"
    else
      warn "JARVIS Bridge not responding — continuing anyway"
    fi
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  NovaMaster Stack is running!${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Office:${NC}        http://localhost:3000"
echo -e "  ${GREEN}Adapter:${NC}       ws://127.0.0.1:18789"
echo -e "  ${GREEN}Gateway:${NC}       ws://127.0.0.1:18791"
echo -e "  ${GREEN}Hermes API:${NC}   http://127.0.0.1:8642"
echo -e "  ${GREEN}Dashboard:${NC}    http://127.0.0.1:9119"
echo ""
echo -e "  ${YELLOW}Logs:${NC}"
echo -e "    Adapter: $ADAPTER_LOG"
echo -e "    Office:  $OFFICE_LOG"
echo ""
echo -e "  Run ${BOLD}./health.sh${NC} for full status check"
echo -e "  Run ${BOLD}./health.sh --watch${NC} for live monitoring"
echo ""