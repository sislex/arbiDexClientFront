#!/usr/bin/env bash
# Поднимает весь стек ArbiDex для вайбкодинга и генерирует auth-state.
#   1) Postgres (docker, :5433)
#   2) Backend  (nest start:dev, :3006)
#   3) Frontend (ng serve, :4200)
#   4) storageState с авторизацией (make-auth-state.mjs)
#
# Логи: e2e/.logs/{server,frontend}.log   PID-файлы: e2e/.logs/*.pid
# Остановить всё:  ./dev-down.sh
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONT_DIR="$(cd "$E2E_DIR/.." && pwd)"
ROOT_DIR="$(cd "$FRONT_DIR/.." && pwd)"
SERVER_DIR="$ROOT_DIR/arbi-dex-server"
LOG_DIR="$E2E_DIR/.logs"
mkdir -p "$LOG_DIR"

wait_for() { # wait_for <url> <name> <max_sec>
  local url="$1" name="$2" max="${3:-120}" i=0
  printf '  ожидаю %s' "$name"
  until curl -sf -o /dev/null "$url" 2>/dev/null; do
    i=$((i+1)); [ "$i" -ge "$max" ] && { echo " — таймаут!"; return 1; }
    printf '.'; sleep 1
  done
  echo " ✓"
}

start_bg() { # start_bg <dir> <logfile> <pidfile> <cmd...>
  local dir="$1" log="$2" pidf="$3"; shift 3
  if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
    echo "  уже запущено (pid $(cat "$pidf"))"; return 0
  fi
  ( cd "$dir" && nohup "$@" >"$log" 2>&1 & echo $! >"$pidf" )
}

echo "▸ 1/4 Postgres (docker :5433)…"
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres
printf '  ожидаю postgres'
for i in $(seq 1 60); do
  if docker exec arbidex_postgres pg_isready -U arbidex -d arbidex_db -p 5433 >/dev/null 2>&1; then
    echo " ✓"; break
  fi; printf '.'; sleep 1
  [ "$i" -eq 60 ] && { echo " — таймаут!"; exit 1; }
done

echo "▸ 2/4 Backend (nest :3006)…"
start_bg "$SERVER_DIR" "$LOG_DIR/server.log" "$LOG_DIR/server.pid" npm run start:dev
wait_for "http://localhost:3006/api/docs" "backend" 180

echo "▸ 3/4 Frontend (ng serve :4200)…"
start_bg "$FRONT_DIR" "$LOG_DIR/frontend.log" "$LOG_DIR/frontend.pid" npm start
wait_for "http://localhost:4200" "frontend" 240

echo "▸ 4/4 Авторизация (storageState)…"
( cd "$E2E_DIR" && node make-auth-state.mjs )

cat <<EOF

✅ Стек поднят.
   Frontend : http://localhost:4200
   Backend  : http://localhost:3006/api   (Swagger: /api/docs)
   Логи     : $LOG_DIR/{server,frontend}.log

   Дальше:
   • сценарии:        (из arbi-dex/) npm run e2e
   • Storybook:       (из arbi-dex/) npm run storybook   → npm run e2e:storybook
   • живое управление: перезапусти Claude Code — поднимется Playwright MCP
   • остановить всё:  e2e/dev-down.sh
EOF
