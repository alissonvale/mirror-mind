#!/bin/bash
set -e

cd "$(dirname "$0")"

SCRIPTS=scripts
LOGFILE=data/dev-server.log

usage() {
  cat <<EOF
Usage: ./mirror.sh [command]

Commands:
  deploy        Push local commits and deploy to prod
  start         Start the dev server in background
  stop          Stop the dev server
  restart       Stop + start
  status        Is the dev server running?
  pull-prod-db  Replace the local dev DB with a snapshot of prod
  logs          Tail the dev server log (Ctrl-C to exit)
  help          Show this message

Run with no arguments for an interactive menu.
EOF
}

run_logs() {
  if [ ! -f "$LOGFILE" ]; then
    echo "No log file at $LOGFILE — server has not been started yet."
    return 1
  fi
  exec tail -f "$LOGFILE"
}

dispatch() {
  case "$1" in
    deploy)       "$SCRIPTS/deploy.sh" ;;
    start)        "$SCRIPTS/dev-start.sh" ;;
    stop)         "$SCRIPTS/dev-stop.sh" ;;
    restart)      "$SCRIPTS/dev-restart.sh" ;;
    status)       "$SCRIPTS/dev-status.sh" ;;
    pull-prod-db) "$SCRIPTS/pull-prod-db.sh" ;;
    logs)         run_logs ;;
    help|-h|--help) usage ;;
    *)
      echo "Unknown command: $1"
      echo
      usage
      exit 1
      ;;
  esac
}

menu() {
  echo "Mirror Mind — dev tools"
  echo
  echo "  1) deploy        — push local commits and deploy to prod"
  echo "  2) start         — start dev server in background"
  echo "  3) stop          — stop dev server"
  echo "  4) restart       — stop + start"
  echo "  5) status        — is the server running?"
  echo "  6) pull-prod-db  — replace local dev DB with prod snapshot"
  echo "  7) logs          — tail server log"
  echo "  q) quit"
  echo
  read -r -p "Choose: " choice
  case "$choice" in
    1) dispatch deploy ;;
    2) dispatch start ;;
    3) dispatch stop ;;
    4) dispatch restart ;;
    5) dispatch status ;;
    6) dispatch pull-prod-db ;;
    7) dispatch logs ;;
    q|Q|"") echo "Bye." ;;
    *) echo "Unknown choice: $choice"; exit 1 ;;
  esac
}

if [ $# -eq 0 ]; then
  menu
else
  dispatch "$@"
fi
