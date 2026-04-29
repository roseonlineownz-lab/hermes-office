#!/usr/bin/env bash
# NovaMaster Watchdog — auto-restart failed services
# Runs via systemd every 60s
set -uo pipefail

LOG="/tmp/novamaster-watchdog.log"
ALERT_WEBHOOK="${NOVAMASTER_ALERT_WEBHOOK:-}"

log() { echo "[$(date -Iseconds)] $*" >> "$LOG"; }

restart_service() {
  local name="$1" url="$2" restart_cmd="$3"
  if ! curl -sf --max-time 3 "$url" &>/dev/null; then
    log "DOWN: $name — attempting restart"
    eval "$restart_cmd" 2>/dev/null
    sleep 3
    if curl -sf --max-time 3 "$url" &>/dev/null; then
      log "RECOVERED: $name"
    else
      log "FAILED: $name still down after restart"
    fi
  fi
}

# Core services
restart_service "Hermes Adapter" "http://127.0.0.1:18789/health" "systemctl --user restart hermes-adapter"
restart_service "NovaMaster Office" "http://127.0.0.1:3000/" "systemctl --user restart novamaster-office"
restart_service "Hermes API" "http://127.0.0.1:8642/health" "systemctl --user restart hermes-gateway"
restart_service "OpenClaw Gateway" "http://127.0.0.1:18791/" "systemctl --user restart openclaw-gateway"
restart_service "Qdrant" "http://127.0.0.1:6333/healthz" "nohup qdrant --config-path /tmp/qdrant-config.yaml &>/dev/null &"

# Docker services — just check, don't restart (docker handles restart: unless-stopped)
for container in novamaster-postgres novamaster-redis novamaster-n8n novamaster-grafana; do
  status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
  if [[ "$status" != "running" ]]; then
    log "DOWN: Docker $container ($status) — attempting restart"
    docker restart "$container" 2>/dev/null || true
  fi
done