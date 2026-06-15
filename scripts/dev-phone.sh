#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${EXPO_PUBLIC_API_URL:-http://localhost:3001}"

cat <<EOF
LastNite phone dev

Android-first path:
  1. Start local services: docker compose -f docker-compose.dev.yml up -d
  2. Start API:            npm run dev:api
  3. In another terminal:  npm run dev:phone

Current mobile API URL:
  EXPO_PUBLIC_API_URL=$API_URL

For a physical Android phone, prefer LAN on the same Wi-Fi. If localhost is not
reachable from the phone, run:
  npm run dev:tunnel

Then restart this command with:
  EXPO_PUBLIC_API_URL=<printed tunnel URL> npm run dev:phone

EOF

cd "$ROOT_DIR/apps/mobile"
EXPO_PUBLIC_API_URL="$API_URL" npx expo start --lan
