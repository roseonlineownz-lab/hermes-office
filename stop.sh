#!/usr/bin/env bash
# NovaMaster Office — stop all services
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[novamaster]${NC} $*"; }

# Core services
log "Stopping NovaMaster Office (port 3000)..."
fuser -k 3000/tcp &>/dev/null || true

log "Stopping Hermes Adapter (port 18789)..."
fuser -k 18789/tcp &>/dev/null || true

log "Stopping Hermes API (port 8642)..."
fuser -k 8642/tcp &>/dev/null || true

log "Stopping OpenClaw Gateway (port 18791)..."
openclaw gateway stop 2>/dev/null || fuser -k 18791/tcp &>/dev/null || true

log "Stopping JARVIS Bridge (port 7777)..."
fuser -k 7777/tcp &>/dev/null || true

log "Stopping Qdrant (port 6333)..."
fuser -k 6333/tcp &>/dev/null || true

# Docker services (optional — uncomment to stop containers)
# COMPOSE_DIR="$HOME/.hermes/docker"
# if [[ -d "$COMPOSE_DIR" ]]; then
#   cd "$COMPOSE_DIR"
#   docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
# fi

log "All local services stopped."
log "Docker containers still running — use 'docker compose down' in $HOME/.hermes/docker to stop them."