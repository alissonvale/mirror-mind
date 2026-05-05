#!/bin/bash
set -e

cd "$(dirname "$0")/.."

PIDFILE=data/dev-server.pid
PORT="${PORT:-3000}"

stop_pid() {
  local pid=$1
  pkill -P "$pid" 2>/dev/null || true
  kill "$pid" 2>/dev/null || true
  for i in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.3
  done
  kill -9 "$pid" 2>/dev/null || true
  pkill -9 -P "$pid" 2>/dev/null || true
}

if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping dev server (PID $PID)..."
    stop_pid "$PID"
  fi
  rm -f "$PIDFILE"
fi

# Cleanup: kill any leftover process on the port (orphans from prior runs)
LEFTOVERS=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [ -n "$LEFTOVERS" ]; then
  echo "Killing leftover processes on port $PORT: $LEFTOVERS"
  echo "$LEFTOVERS" | xargs kill 2>/dev/null || true
  sleep 0.5
  LEFTOVERS=$(lsof -ti ":$PORT" 2>/dev/null || true)
  if [ -n "$LEFTOVERS" ]; then
    echo "$LEFTOVERS" | xargs kill -9 2>/dev/null || true
  fi
fi

echo "Dev server stopped."
