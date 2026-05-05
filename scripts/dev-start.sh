#!/bin/bash
set -e

cd "$(dirname "$0")/.."

PIDFILE=data/dev-server.pid
LOGFILE=data/dev-server.log
PORT="${PORT:-3000}"

mkdir -p data

if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "Dev server already running (PID $PID)"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

if lsof -ti ":$PORT" > /dev/null 2>&1; then
  echo "Port $PORT is in use by another process. Run scripts/dev-stop.sh first."
  exit 1
fi

nohup npm run dev > "$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"
PID=$(cat "$PIDFILE")
echo "Dev server starting (PID $PID). Logs: $LOGFILE"

for i in $(seq 1 30); do
  sleep 0.5
  if curl -fs "http://localhost:$PORT/" > /dev/null 2>&1; then
    echo "Server responding at http://localhost:$PORT"
    exit 0
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "Dev server died during startup. See $LOGFILE"
    rm -f "$PIDFILE"
    exit 1
  fi
done

echo "WARNING: server did not respond within 15s. Check $LOGFILE"
exit 1
