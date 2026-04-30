#!/usr/bin/env bash
# NovaMaster Office — health check for all services
# Usage: ./health.sh [--json] [--watch]
set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

JSON_MODE=false
WATCH_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true
[[ "${1:-}" == "--watch" ]] && WATCH_MODE=true

check_http() {
  local name="$1" url="$2" timeout="${3:-3}"
  local start=$(date +%s%N)
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$timeout" "$url" 2>/dev/null) || code="000"
  local end=$(date +%s%N)
  local ms=$(( (end - start) / 1000000 ))
  # 407 = proxy auth required = service is UP, just needs auth
  # 401 = unauthorized = service is UP
  if [[ "$code" =~ ^(2|3|4) ]] && [[ "$code" != "000" ]]; then
    echo "UP|$name|$url|${ms}ms"
  else
    echo "DOWN|$name|$url|timeout"
  fi
}

check_port() {
  local name="$1" port="$2"
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    echo "UP|$name|port:$port|listening"
  else
    echo "DOWN|$name|port:$port|not_listening"
  fi
}

check_docker() {
  local name="$1"
  local status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
  if [[ "$status" == "running" ]]; then
    echo "UP|$name|docker|running"
  else
    echo "DOWN|$name|docker|$status"
  fi
}

run_checks() {
  local results=()
  local up=0 down=0

  # Core services
  results+=("$(check_http "NovaMaster Office" http://127.0.0.1:3000/)")
  results+=("$(check_http "Hermes Adapter" http://127.0.0.1:18789/health)")
  results+=("$(check_http "Hermes API" http://127.0.0.1:8642/health)")
  results+=("$(check_http "OpenClaw Gateway" http://127.0.0.1:18791/health)")
  results+=("$(check_http "GoClaw" http://127.0.0.1:18790/health)")
  results+=("$(check_http "MetaClaw" http://127.0.0.1:30000/health)")
  results+=("$(check_http "Space Agent" http://127.0.0.1:3003/)")
  results+=("$(check_http "JARVIS" http://127.0.0.1:8888/health)")
  results+=("$(check_http "JARVIS Bridge" http://127.0.0.1:7777/health)")

  # AI / LLM
  results+=("$(check_http "Ollama" http://127.0.0.1:11434/api/version)")
  results+=("$(check_http "LiteLLM" http://127.0.0.1:4000/)")
  results+=("$(check_http "NovaMaster API" http://127.0.0.1:8091/health)")
  results+=("$(check_http "ViralHunter API" http://127.0.0.1:8092/health)")
  results+=("$(check_http "VibeVoice" http://127.0.0.1:8093/config)")
  results+=("$(check_http "VibeVoice Bridge" http://127.0.0.1:8094/health)")
  results+=("$(check_http "ClawMem Serve" http://127.0.0.1:7438/health)")

  # Database
  results+=("$(check_http "Qdrant" http://127.0.0.1:6333/healthz)")
  results+=("$(check_port "PostgreSQL" 5432)")
  results+=("$(check_port "Redis" 6379)")

  # Dashboard / Monitoring
  results+=("$(check_http "Hermes Dashboard" http://127.0.0.1:9119/health)")
  results+=("$(check_http "Grafana" http://127.0.0.1:3001/api/health)")
  results+=("$(check_http "Prometheus" http://127.0.0.1:9090/-/healthy)")
  results+=("$(check_http "Uptime Kuma" http://127.0.0.1:3002/)")
  results+=("$(check_http "Langfuse" http://127.0.0.1:3099/)")

  # Workflow / Automation
  results+=("$(check_http "n8n" http://127.0.0.1:5678/healthz)")
  results+=("$(check_http "Activepieces" http://127.0.0.1:3005/health)")
  results+=("$(check_http "CrabTrap" http://127.0.0.1:8082/ 3)")

  # UI / Web
  results+=("$(check_http "Dify" http://127.0.0.1:3081/install)")
  results+=("$(check_http "Open WebUI" http://127.0.0.1:3080/)")
  results+=("$(check_http "Jet Admin" http://127.0.0.1:3082/api/)")
  results+=("$(check_http "ComfyUI" http://127.0.0.1:8188/)")
  results+=("$(check_http "Portainer" http://127.0.0.1:9000/)")
  results+=("$(check_http "HTTP Fileserver" http://127.0.0.1:8090/)")
  results+=("$(check_http "Open Notebook" http://127.0.0.1:8502/)")
  results+=("$(check_http "Open Notebook API" http://127.0.0.1:5055/health)")

  # Events / Messaging
  results+=("$(check_port "Event Bus" 5670)")
  results+=("$(check_http "AIRI" http://127.0.0.1:6113/)")
  results+=("$(check_port "Temporal" 7233)")

  # Process results
  for r in "${results[@]}"; do
    IFS='|' read -r status name url latency <<< "$r"
    if [[ "$status" == "UP" ]]; then
      ((up++))
    else
      ((down++))
    fi
  done

  if $JSON_MODE; then
    echo "{"
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"total\": $((up + down)),"
    echo "  \"up\": $up,"
    echo "  \"down\": $down,"
    echo "  \"services\": ["
    local first=true
    for r in "${results[@]}"; do
      IFS='|' read -r status name url latency <<< "$r"
      if ! $first; then echo ","; fi
      first=false
      printf '    {"name": "%s", "status": "%s", "url": "%s", "latency": "%s"}' "$name" "$status" "$url" "$latency"
    done
    echo ""
    echo "  ]"
    echo "}"
    return
  fi

  # Human-readable output
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  NovaMaster Ecosystem Health Check${NC}"
  echo -e "${BOLD}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo ""

  # Core
  echo -e "${BOLD}── Core ──────────────────────────────────────────${NC}"
  for r in "${results[@]}"; do
    IFS='|' read -r status name url latency <<< "$r"
    case "$name" in
      NovaMaster\ Office|Hermes\ Adapter|Hermes\ API|OpenClaw\ Gateway|GoClaw|MetaClaw|Space\ Agent|JARVIS|JARVIS\ Bridge)
        if [[ "$status" == "UP" ]]; then
          echo -e "  ${GREEN}✓${NC} $name ${YELLOW}($latency)${NC}"
        else
          echo -e "  ${RED}✗${NC} $name ${RED}DOWN${NC}"
        fi
        ;;
    esac
  done

  echo ""
  echo -e "${BOLD}── AI / LLM ─────────────────────────────────────${NC}"
  for r in "${results[@]}"; do
    IFS='|' read -r status name url latency <<< "$r"
    case "$name" in
      Ollama|LiteLLM|NovaMaster\ API|ViralHunter\ API|VibeVoice|VibeVoice\ Bridge|ClawMem\ Serve)
        if [[ "$status" == "UP" ]]; then
          echo -e "  ${GREEN}✓${NC} $name ${YELLOW}($latency)${NC}"
        else
          echo -e "  ${RED}✗${NC} $name ${RED}DOWN${NC}"
        fi
        ;;
    esac
  done

  echo ""
  echo -e "${BOLD}── Database ─────────────────────────────────────${NC}"
  for r in "${results[@]}"; do
    IFS='|' read -r status name url latency <<< "$r"
    case "$name" in
      Qdrant|PostgreSQL|Redis)
        if [[ "$status" == "UP" ]]; then
          echo -e "  ${GREEN}✓${NC} $name ${YELLOW}($latency)${NC}"
        else
          echo -e "  ${RED}✗${NC} $name ${RED}DOWN${NC}"
        fi
        ;;
    esac
  done

  echo ""
  echo -e "${BOLD}── Dashboard / Monitoring ───────────────────────${NC}"
  for r in "${results[@]}"; do
    IFS='|' read -r status name url latency <<< "$r"
    case "$name" in
      Hermes\ Dashboard|Grafana|Prometheus|Uptime\ Kuma|Langfuse)
        if [[ "$status" == "UP" ]]; then
          echo -e "  ${GREEN}✓${NC} $name ${YELLOW}($latency)${NC}"
        else
          echo -e "  ${RED}✗${NC} $name ${RED}DOWN${NC}"
        fi
        ;;
    esac
  done

  echo ""
  echo -e "${BOLD}── Workflow / Automation ─────────────────────────${NC}"
  for r in "${results[@]}"; do
    IFS='|' read -r status name url latency <<< "$r"
    case "$name" in
      n8n|Activepieces|CrabTrap)
        if [[ "$status" == "UP" ]]; then
          echo -e "  ${GREEN}✓${NC} $name ${YELLOW}($latency)${NC}"
        else
          echo -e "  ${RED}✗${NC} $name ${RED}DOWN${NC}"
        fi
        ;;
    esac
  done

  echo ""
  echo -e "${BOLD}── UI / Web ──────────────────────────────────────${NC}"
  for r in "${results[@]}"; do
    IFS='|' read -r status name url latency <<< "$r"
    case "$name" in
      Open\ WebUI|Dify|Jet\ Admin|ComfyUI|Portainer|HTTP\ Fileserver|Open\ Notebook|Open\ Notebook\ API)
        if [[ "$status" == "UP" ]]; then
          echo -e "  ${GREEN}✓${NC} $name ${YELLOW}($latency)${NC}"
        else
          echo -e "  ${RED}✗${NC} $name ${RED}DOWN${NC}"
        fi
        ;;
    esac
  done

  echo ""
  echo -e "${BOLD}── Events / Messaging ────────────────────────────${NC}"
  for r in "${results[@]}"; do
    IFS='|' read -r status name url latency <<< "$r"
    case "$name" in
      Event\ Bus|AIRI|Temporal)
        if [[ "$status" == "UP" ]]; then
          echo -e "  ${GREEN}✓${NC} $name ${YELLOW}($latency)${NC}"
        else
          echo -e "  ${RED}✗${NC} $name ${RED}DOWN${NC}"
        fi
        ;;
    esac
  done

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  if [[ $down -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}All $up services UP${NC}"
  else
    echo -e "  ${GREEN}$up UP${NC} / ${RED}$down DOWN${NC} — $((up * 100 / (up + down)))% healthy"
  fi
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo ""
}

if $WATCH_MODE; then
  while true; do
    clear
    run_checks
    sleep 10
  done
else
  run_checks
fi
  # Voice
  results+=("$(check_http "NovaMaster Voice" http://127.0.0.1:0/health 2)")  # voice runs as systemd, no HTTP port
  results+=("$(check_http "ClawMem" http://127.0.0.1:7438/health 3)")

  # Orchestration
  results+=("$(check_http "LangGraph Pipeline" http://127.0.0.1:8127/health 3)")
  results+=("$(check_http "LangGraph Orchestrator" http://127.0.0.1:8128/health 3)")
  results+=("$(check_http "Lead Engine" http://127.0.0.1:8130/health 3)")
  results+=("$(check_http "Scraper Bot" http://127.0.0.1:8131/health 3)")
  results+=("$(check_http "Email Agent" http://127.0.0.1:8132/health 3)")
  results+=("$(check_http "SA Orchestrator" http://127.0.0.1:8133/health 3)")
  results+=("$(check_http "CrewAI" http://127.0.0.1:8135/health 3)")

  # Dashboard section - add Jet Admin
  results+=("$(check_http "Jet Admin" http://127.0.0.1:3082/api/ 3)")
