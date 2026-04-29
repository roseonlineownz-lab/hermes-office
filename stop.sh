#!/usr/bin/env bash
# Hermes Office — stop all services
set -euo pipefail

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[hermes-office]${NC} $*"; }

log "Stopping Claw3D Office (port 3000)..."
fuser -k 3000/tcp &>/dev/null || true

log "Stopping Hermes Adapter (port 18789)..."
fuser -k 18789/tcp &>/dev/null || true

log "Stopping Hermes API (port 8642)..."
fuser -k 8642/tcp &>/dev/null || true

log "Stopping OpenClaw Gateway (port 18791)..."
openclaw gateway stop 2>/dev/null || fuser -k 18791/tcp &>/dev/null || true

log "All services stopped."