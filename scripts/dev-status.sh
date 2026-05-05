#!/bin/bash
set +e

cd "$(dirname "$0")/.."

PIDFILE=data/dev-server.pid
LOGFILE=data/dev-server.log
PORT="${PORT:-3000}"

if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "✓ Running (PID $PID)"
    if curl -fs "http://localhost:$PORT/" > /dev/null 2>&1; then
      echo "  http://localhost:$PORT — responding"
    else
      echo "  http://localhost:$PORT — not responding yet"
    fi
    echo "  Logs: $LOGFILE"
    exit 0
  else
    echo "✗ Stale PID file (process $PID is dead)"
    exit 1
  fi
fi

LEFTOVERS=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [ -n "$LEFTOVERS" ]; then
  echo "✗ No PID file, but port $PORT is held by: $LEFTOVERS"
  exit 1
fi

echo "✗ Not running"
exit 1
