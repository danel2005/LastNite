#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
start-dev.sh is now a compatibility wrapper.

Use these npm scripts directly:
  npm run dev:all     # API + Expo mobile
  npm run dev:api     # API only
  npm run dev:worker  # workers/scheduler only
  npm run dev:phone   # Android-first Expo phone flow
  npm run dev:tunnel  # optional API-only tunnel

Starting npm run dev:all now...
EOF

npm run dev:all
