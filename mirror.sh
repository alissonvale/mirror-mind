#!/bin/bash
set -e

cd "$(dirname "$0")"

SCRIPTS=scripts
LOGFILE=data/dev-server.log

usage() {
  cat <<EOF
Usage: ./mirror.sh [command]

Commands:
  start        Start the dev server in background
  stop         Stop the dev server
  restart      Stop + start
  status       Is the dev server running?
  logs         Tail the dev server log (Ctrl-C to exit)
  pull-prod    Replace the local dev DB with a snapshot of prod
  help         Show this message

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
    start)     "$SCRIPTS/dev-start.sh" ;;
    stop)      "$SCRIPTS/dev-stop.sh" ;;
    restart)   "$SCRIPTS/dev-restart.sh" ;;
    status)    "$SCRIPTS/dev-status.sh" ;;
    logs)      run_logs ;;
    pull-prod) "$SCRIPTS/pull-prod-db.sh" ;;
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
  echo "  1) start      — start dev server in background"
  echo "  2) stop       — stop dev server"
  echo "  3) restart    — stop + start"
  echo "  4) status     — is the server running?"
  echo "  5) logs       — tail server log"
  echo "  6) pull-prod  — replace local dev DB with prod snapshot"
  echo "  q) quit"
  echo
  read -r -p "Choose: " choice
  case "$choice" in
    1) dispatch start ;;
    2) dispatch stop ;;
    3) dispatch restart ;;
    4) dispatch status ;;
    5) dispatch logs ;;
    6) dispatch pull-prod ;;
    q|Q|"") echo "Bye." ;;
    *) echo "Unknown choice: $choice"; exit 1 ;;
  esac
}

if [ $# -eq 0 ]; then
  menu
else
  dispatch "$@"
fi
