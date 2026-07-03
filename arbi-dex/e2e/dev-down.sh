#!/usr/bin/env bash
# Останавливает стек, поднятый dev-up.sh (frontend, backend, опц. postgres).
set -uo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$E2E_DIR/../.." && pwd)"
LOG_DIR="$E2E_DIR/.logs"

stop_pid() { # stop_pid <pidfile> <name>
  local pidf="$1" name="$2"
  if [ -f "$pidf" ]; then
    local pid; pid="$(cat "$pidf")"
    if kill -0 "$pid" 2>/dev/null; then
      # убиваем дерево процессов (nest/ng порождают дочерние)
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      echo "  ✓ $name остановлен (pid $pid)"
    fi
    rm -f "$pidf"
  fi
}

echo "▸ Останавливаю frontend / backend…"
stop_pid "$LOG_DIR/frontend.pid" "frontend"
stop_pid "$LOG_DIR/server.pid" "backend"

if [ "${1:-}" = "--with-db" ]; then
  echo "▸ Останавливаю postgres…"
  docker compose -f "$ROOT_DIR/docker-compose.yml" stop postgres
else
  echo "  postgres оставлен запущенным (стоп: ./dev-down.sh --with-db)"
fi
echo "✅ Готово."
