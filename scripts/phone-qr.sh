#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${LASTNITE_PHONE_STATE_DIR:-/tmp/lastnite-phone}"
API_PORT="${API_PORT:-3001}"
EXPO_PORT="${EXPO_PORT:-8081}"
DATABASE_URL="${DATABASE_URL:-postgresql://lastnite:lastnite@localhost:5432/lastnite_dev}"
DEV_AUTH_OTP="${DEV_AUTH_OTP:-123456}"
LASTNITE_PHONE_MODE="${LASTNITE_PHONE_MODE:-lan}"
PRISMA_ENV="$ROOT_DIR/packages/db/prisma/.env"
PRISMA_ENV_BACKUP="$STATE_DIR/prisma.env.bak"
RESTORE_PRISMA_ENV=0

mkdir -p "$STATE_DIR"

log() {
  printf '\n%s\n' "$*"
}

find_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    command -v cloudflared
    return
  fi

  if [[ -x "$HOME/.local/bin/cloudflared" ]]; then
    printf '%s\n' "$HOME/.local/bin/cloudflared"
    return
  fi

  return 1
}

pid_is_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

stop_pid_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0

  local pid
  pid="$(cat "$file" 2>/dev/null || true)"
  if pid_is_alive "$pid"; then
    kill -TERM -- "-$pid" >/dev/null 2>&1 || kill -TERM "$pid" >/dev/null 2>&1 || true
  fi
  rm -f "$file"
}

stop_port_processes() {
  local port="$1"
  if ! command -v ss >/dev/null 2>&1; then
    return 0
  fi

  local pids
  pids="$(ss -ltnp "sport = :$port" 2>/dev/null | grep -Eo 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)"
  [[ -n "$pids" ]] || return 0

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    kill -TERM "$pid" >/dev/null 2>&1 || true
  done <<<"$pids"
}

restore_prisma_env() {
  if [[ "$RESTORE_PRISMA_ENV" == "1" && -f "$PRISMA_ENV_BACKUP" ]]; then
    mv "$PRISMA_ENV_BACKUP" "$PRISMA_ENV"
    RESTORE_PRISMA_ENV=0
  fi
}

cleanup_background() {
  stop_pid_file "$STATE_DIR/expo-tunnel.pid"
  stop_pid_file "$STATE_DIR/api-tunnel.pid"
  stop_pid_file "$STATE_DIR/api.pid"
  restore_prisma_env
}

stop_all() {
  log "Stopping LastNite phone dev processes..."
  cleanup_background
  stop_port_processes "$EXPO_PORT"
  stop_port_processes "$API_PORT"
  log "Stopped. Docker Postgres is left running so the next start is fast."
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local timeout_seconds="${3:-60}"
  local start
  start="$(date +%s)"

  until curl -fsS "$url" >/dev/null 2>&1; do
    if (( $(date +%s) - start > timeout_seconds )); then
      printf '%s did not become ready at %s\n' "$label" "$url" >&2
      return 1
    fi
    sleep 1
  done
}

wait_for_tunnel_url() {
  local log_file="$1"
  local label="$2"
  local timeout_seconds="${3:-45}"
  local start
  start="$(date +%s)"

  while true; do
    local url
    url="$(grep -Eom1 'https://[a-z0-9-]+\.trycloudflare\.com' "$log_file" 2>/dev/null || true)"
    if [[ -n "$url" ]]; then
      printf '%s\n' "$url"
      return 0
    fi

    if (( $(date +%s) - start > timeout_seconds )); then
      printf '%s tunnel did not print a Cloudflare URL. Log: %s\n' "$label" "$log_file" >&2
      return 1
    fi
    sleep 1
  done
}

get_lan_ip() {
  if command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") {print $(i+1); exit}}'
    return
  fi

  hostname -I 2>/dev/null | awk '{print $1}'
}

is_wsl() {
  grep -qi microsoft /proc/version 2>/dev/null
}

get_wsl_ip() {
  hostname -I 2>/dev/null | awk '{print $1}'
}

get_windows_lan_ip() {
  powershell.exe -NoProfile -Command "& {
    Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' |
      ForEach-Object { \$_.IPAddress } |
      Where-Object {
        \$_ -match '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' -and
        \$_ -ne '127.0.0.1' -and
        \$_ -notlike '169.254*' -and
        \$_ -notlike '172.*' -and
        \$_ -notlike '192.168.100.*'
      } |
      Select-Object -First 1
  }" 2>/dev/null | tr -d '\r' | awk 'NF {print; exit}'
}

configure_wsl_portproxy() {
  local windows_ip="$1"
  local wsl_ip="$2"
  local port="$3"

  powershell.exe -NoProfile -Command "& {
    netsh interface portproxy delete v4tov4 listenaddress=$windows_ip listenport=$port | Out-Null
    netsh interface portproxy add v4tov4 listenaddress=$windows_ip listenport=$port connectaddress=$wsl_ip connectport=$port
  }" >/dev/null
}

wsl_portproxy_exists() {
  local windows_ip="$1"
  local wsl_ip="$2"
  local port="$3"

  powershell.exe -NoProfile -Command "netsh interface portproxy show v4tov4" 2>/dev/null |
    tr -d '\r' |
    grep -F "$windows_ip" |
    grep -F "$wsl_ip" |
    grep -F "$port" >/dev/null
}

print_wsl_admin_setup() {
  local windows_ip="$1"
  local wsl_ip="$2"

  cat >&2 <<EOF
Windows needs Administrator permission to expose WSL to your phone.

Open PowerShell as Administrator and run this once, then rerun:
  npm run dev:qr

Commands:
  netsh interface portproxy delete v4tov4 listenaddress=$windows_ip listenport=$API_PORT
  netsh interface portproxy delete v4tov4 listenaddress=$windows_ip listenport=$EXPO_PORT
  netsh interface portproxy add v4tov4 listenaddress=$windows_ip listenport=$API_PORT connectaddress=$wsl_ip connectport=$API_PORT
  netsh interface portproxy add v4tov4 listenaddress=$windows_ip listenport=$EXPO_PORT connectaddress=$wsl_ip connectport=$EXPO_PORT
  New-NetFirewallRule -DisplayName "LastNite API $API_PORT" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $API_PORT
  New-NetFirewallRule -DisplayName "LastNite Expo $EXPO_PORT" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $EXPO_PORT

Why: WSL advertised $wsl_ip, but your phone needs the Windows Wi-Fi/hotspot IP $windows_ip.
EOF
}

open_tunnel_with_retry() {
  local name="$1"
  local label="$2"
  local port="$3"
  local cloudflared="$4"
  local attempts="${5:-4}"
  local attempt

  for attempt in $(seq 1 "$attempts"); do
    stop_pid_file "$STATE_DIR/$name.pid"
    start_background "$name" "'$cloudflared' tunnel --url 'http://localhost:$port' --no-autoupdate"

    if wait_for_tunnel_url "$STATE_DIR/$name.log" "$label" 45; then
      return 0
    fi

    stop_pid_file "$STATE_DIR/$name.pid"
    printf '%s tunnel attempt %s/%s failed. Retrying...\n' "$label" "$attempt" "$attempts" >&2
    sleep 2
  done

  printf '%s tunnel failed after %s attempts. Last log: %s/%s.log\n' "$label" "$attempts" "$STATE_DIR" "$name" >&2
  return 1
}

start_background() {
  local name="$1"
  local command="$2"
  local log_file="$STATE_DIR/$name.log"
  local pid_file="$STATE_DIR/$name.pid"

  : > "$log_file"
  setsid bash -lc "$command" >"$log_file" 2>&1 < /dev/null &
  printf '%s' "$!" > "$pid_file"
}

prepare_database() {
  log "Starting local Postgres..."
  docker compose -f "$ROOT_DIR/docker-compose.dev.yml" up -d postgres postgres_test

  log "Waiting for Postgres..."
  local start
  start="$(date +%s)"
  until docker compose -f "$ROOT_DIR/docker-compose.dev.yml" exec -T postgres pg_isready -U lastnite -d lastnite_dev >/dev/null 2>&1; do
    if (( $(date +%s) - start > 60 )); then
      printf 'Postgres did not become ready. Run docker compose -f docker-compose.dev.yml logs postgres for details.\n' >&2
      return 1
    fi
    sleep 1
  done

  log "Preparing Prisma schema and seed data..."
  if [[ -f "$PRISMA_ENV" ]]; then
    rm -f "$PRISMA_ENV_BACKUP"
    mv "$PRISMA_ENV" "$PRISMA_ENV_BACKUP"
    RESTORE_PRISMA_ENV=1
  fi

  (
    cd "$ROOT_DIR/packages/db"
    DATABASE_URL="$DATABASE_URL" npx prisma db push
    local seed_state
    seed_state="$(
      docker compose -f "$ROOT_DIR/docker-compose.dev.yml" exec -T postgres \
        psql -U lastnite -d lastnite_dev -tAc "SELECT CASE WHEN EXISTS (SELECT 1 FROM mission_definitions WHERE is_system = true) AND EXISTS (SELECT 1 FROM mission_packs WHERE is_system = true) THEN 'ready' ELSE 'seed' END;"
    )"
    if [[ "$seed_state" == "ready" ]]; then
      echo "System seed data already exists; skipping seed."
    else
      DATABASE_URL="$DATABASE_URL" npm run db:seed
    fi
  )

  restore_prisma_env
}

start_api() {
  log "Starting API on localhost:$API_PORT..."
  stop_pid_file "$STATE_DIR/api.pid"
  stop_port_processes "$API_PORT"

  start_background "api" "cd '$ROOT_DIR/apps/api' && NODE_ENV=development PORT='$API_PORT' HOST=0.0.0.0 RUN_BACKGROUND_JOBS=false DEV_AUTH_OTP='$DEV_AUTH_OTP' DATABASE_URL='$DATABASE_URL' npx tsx watch src/index.ts"
  wait_for_http "http://localhost:$API_PORT/health" "API" 60
}

start_tunnels() {
  local cloudflared="$1"

  log "Opening API tunnel..."
  stop_pid_file "$STATE_DIR/api-tunnel.pid"
  API_TUNNEL_URL="$(open_tunnel_with_retry "api-tunnel" "API" "$API_PORT" "$cloudflared")"

  log "Opening Expo tunnel..."
  stop_pid_file "$STATE_DIR/expo-tunnel.pid"
  stop_port_processes "$EXPO_PORT"
  EXPO_TUNNEL_URL="$(open_tunnel_with_retry "expo-tunnel" "Expo" "$EXPO_PORT" "$cloudflared")"
}

print_ready() {
  local expo_manual_url="$1"
  local log_list="$STATE_DIR/api.log"
  if [[ "$LASTNITE_PHONE_MODE" == "tunnel" ]]; then
    log_list="$log_list
  $STATE_DIR/api-tunnel.log
  $STATE_DIR/expo-tunnel.log"
  fi

  cat <<EOF

LastNite is ready for phone testing.

API URL:
  $EXPO_PUBLIC_API_URL

Expo Go manual URL, if the QR is stubborn:
  $expo_manual_url

Dev login OTP:
  $DEV_AUTH_OTP

Logs:
  $log_list

Expo starts now. Scan the QR in this terminal with Expo Go.
Press Ctrl+C here to stop the API and Expo.

EOF
}

main() {
  case "${1:-start}" in
    start)
      ;;
    stop)
      stop_all
      exit 0
      ;;
    -h|--help|help)
      cat <<EOF
Usage:
  npm run dev:qr
  npm run dev:qr -- stop

Optional env:
  DEV_AUTH_OTP=123456
  API_PORT=3001
  EXPO_PORT=8081
  DATABASE_URL=postgresql://lastnite:lastnite@localhost:5432/lastnite_dev
  LASTNITE_PHONE_MODE=lan|tunnel  # lan is the default

Tunnel mode, when LAN/hotspot does not work:
  LASTNITE_PHONE_MODE=tunnel npm run dev:qr
EOF
      exit 0
      ;;
    *)
      printf 'Unknown command: %s\n\n' "$1" >&2
      "$0" --help >&2
      exit 1
      ;;
  esac

  if [[ "$LASTNITE_PHONE_MODE" != "lan" && "$LASTNITE_PHONE_MODE" != "tunnel" ]]; then
    printf 'Invalid LASTNITE_PHONE_MODE: %s. Use lan or tunnel.\n' "$LASTNITE_PHONE_MODE" >&2
    exit 1
  fi

  local cloudflared=""
  if [[ "$LASTNITE_PHONE_MODE" == "tunnel" ]] && ! cloudflared="$(find_cloudflared)"; then
    cat >&2 <<EOF
cloudflared is required for tunnel mode.

Install it, or use the default LAN flow instead:
  npm run dev:qr
EOF
    exit 1
  fi

  trap cleanup_background EXIT INT TERM

  cleanup_background
  prepare_database
  start_api

  cd "$ROOT_DIR/apps/mobile"
  if [[ "$LASTNITE_PHONE_MODE" == "tunnel" ]]; then
    start_tunnels "$cloudflared"
    local expo_host
    expo_host="${EXPO_TUNNEL_URL#https://}"
    EXPO_PUBLIC_API_URL="$API_TUNNEL_URL"
    print_ready "exp://$expo_host"

    EXPO_PUBLIC_API_URL="$EXPO_PUBLIC_API_URL" \
      EXPO_PACKAGER_PROXY_URL="http://$expo_host" \
      npx expo start --clear --port "$EXPO_PORT"
  else
    local lan_ip
    local wsl_ip=""
    if is_wsl; then
      wsl_ip="$(get_wsl_ip)"
      lan_ip="$(get_windows_lan_ip)"
      if [[ -z "$lan_ip" || -z "$wsl_ip" ]]; then
        printf 'Could not detect Windows LAN IP from WSL. Try LASTNITE_PHONE_MODE=tunnel npm run dev:qr\n' >&2
        exit 1
      fi

      log "WSL detected. Forwarding Windows $lan_ip ports to WSL $wsl_ip..."
      configure_wsl_portproxy "$lan_ip" "$wsl_ip" "$API_PORT" || true
      if ! wsl_portproxy_exists "$lan_ip" "$wsl_ip" "$API_PORT"; then
        print_wsl_admin_setup "$lan_ip" "$wsl_ip"
        exit 1
      fi
      configure_wsl_portproxy "$lan_ip" "$wsl_ip" "$EXPO_PORT" || true
      if ! wsl_portproxy_exists "$lan_ip" "$wsl_ip" "$EXPO_PORT"; then
        print_wsl_admin_setup "$lan_ip" "$wsl_ip"
        exit 1
      fi
    else
      lan_ip="$(get_lan_ip)"
    fi

    if [[ -z "$lan_ip" ]]; then
      printf 'Could not detect this computer LAN IP. Try LASTNITE_PHONE_MODE=tunnel npm run dev:qr\n' >&2
      exit 1
    fi

    EXPO_PUBLIC_API_URL="http://$lan_ip:$API_PORT"
    print_ready "exp://$lan_ip:$EXPO_PORT"
    stop_port_processes "$EXPO_PORT"
    EXPO_PUBLIC_API_URL="$EXPO_PUBLIC_API_URL" \
      REACT_NATIVE_PACKAGER_HOSTNAME="$lan_ip" \
      npx expo start --lan --clear --port "$EXPO_PORT"
  fi
}

main "$@"
