#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"

if command -v cloudflared >/dev/null 2>&1; then
  exec cloudflared tunnel --url "http://localhost:${PORT}" --no-autoupdate
fi

if [[ -x "$HOME/.local/bin/cloudflared" ]]; then
  exec "$HOME/.local/bin/cloudflared" tunnel --url "http://localhost:${PORT}" --no-autoupdate
fi

cat >&2 <<EOF
cloudflared is not installed.

Install it, or deploy the API to a staging host and set:
  EXPO_PUBLIC_API_URL=https://your-api.example.com npm run dev:phone
EOF
exit 1
