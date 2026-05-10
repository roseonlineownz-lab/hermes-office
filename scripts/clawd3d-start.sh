#!/usr/bin/env bash
set -euo pipefail

LAUNCHER="${HOME}/bin/claw3d-launcher"
if [[ -x "$LAUNCHER" ]]; then
  exec "$LAUNCHER" "$@"
fi

echo "[clawd3d-start] ERROR: launcher ontbreekt op ${LAUNCHER}" >&2
echo "[clawd3d-start] fallback naar handmatige start met npm-script." >&2
cd /home/faramix/.hermes/hermes-office
exec npm run dev
