#!/bin/bash
set -e

cd "$(dirname "$0")/.."

VPS="${MIRROR_VPS:-root@51.222.160.3}"
REMOTE_DB=/opt/mirror/data/mirror.db
LOCAL_DB=data/mirror.db
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOCAL_BACKUP="data/mirror.db.bak-pre-prod-pull-$TIMESTAMP"
REMOTE_SNAPSHOT="/tmp/mirror-snapshot-$TIMESTAMP.db"
LOCAL_SNAPSHOT="/tmp/mirror-snapshot-$TIMESTAMP.db"

human_size() {
  ls -lh "$1" 2>/dev/null | awk '{print $5}'
}

cleanup_remote() {
  ssh -q "$VPS" "rm -f $REMOTE_SNAPSHOT" >/dev/null 2>&1 || true
}
trap cleanup_remote EXIT

echo "═══════════════════════════════════════════════════════════"
echo " Pull prod DB → dev"
echo "═══════════════════════════════════════════════════════════"
echo "  source     : $VPS:$REMOTE_DB"
echo "  target     : $LOCAL_DB"
echo "  timestamp  : $TIMESTAMP"
echo "  backup as  : $LOCAL_BACKUP"
echo

echo "[1/6] Pre-flight check on $VPS"
echo "      Verifying sqlite3 is installed and prod DB exists..."
PREFLIGHT=$(ssh "$VPS" bash -s <<EOF
set -e
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "MISSING_SQLITE3"
  exit 0
fi
if [ ! -f $REMOTE_DB ]; then
  echo "MISSING_DB"
  exit 0
fi
echo "OK"
ls -lh $REMOTE_DB | awk '{print "      prod DB size: " \$5}'
sqlite3 $REMOTE_DB "SELECT 'prod sessions: '||COUNT(*) FROM sessions;" 2>/dev/null || true
sqlite3 $REMOTE_DB "SELECT 'prod entries:  '||COUNT(*) FROM entries;" 2>/dev/null || true
EOF
)

if echo "$PREFLIGHT" | grep -q "MISSING_SQLITE3"; then
  echo "      ✗ sqlite3 is not installed on $VPS"
  echo
  echo "      Install it with:"
  echo "        ssh $VPS 'apt-get update && apt-get install -y sqlite3'"
  echo
  exit 1
fi
if echo "$PREFLIGHT" | grep -q "MISSING_DB"; then
  echo "      ✗ prod DB not found at $REMOTE_DB"
  exit 1
fi

echo "$PREFLIGHT" | tail -n +2 | sed 's/^/      /'
echo "      ✓ pre-flight ok"
echo

echo "[2/6] Creating online SQLite snapshot on $VPS"
echo "      Running: sqlite3 $REMOTE_DB '.backup $REMOTE_SNAPSHOT'"
ssh "$VPS" "sqlite3 $REMOTE_DB \".backup $REMOTE_SNAPSHOT\" && ls -lh $REMOTE_SNAPSHOT | awk '{print \"      snapshot size: \"\$5}'"
echo "      ✓ snapshot created"
echo

echo "[3/6] Downloading snapshot to $LOCAL_SNAPSHOT"
scp "$VPS:$REMOTE_SNAPSHOT" "$LOCAL_SNAPSHOT"
echo "      ✓ downloaded ($(human_size "$LOCAL_SNAPSHOT"))"
echo

echo "[4/6] Verifying snapshot integrity locally"
INTEGRITY=$(sqlite3 "$LOCAL_SNAPSHOT" 'PRAGMA integrity_check;' | head -1)
if [ "$INTEGRITY" != "ok" ]; then
  echo "      ✗ integrity check failed: $INTEGRITY"
  exit 1
fi
SESSION_COUNT=$(sqlite3 "$LOCAL_SNAPSHOT" 'SELECT COUNT(*) FROM sessions;' 2>/dev/null || echo "?")
ENTRY_COUNT=$(sqlite3 "$LOCAL_SNAPSHOT" 'SELECT COUNT(*) FROM entries;' 2>/dev/null || echo "?")
USER_COUNT=$(sqlite3 "$LOCAL_SNAPSHOT" 'SELECT COUNT(*) FROM users;' 2>/dev/null || echo "?")
echo "      ✓ integrity ok"
echo "      users: $USER_COUNT, sessions: $SESSION_COUNT, entries: $ENTRY_COUNT"
echo

echo "[5/6] Replacing local dev DB"
echo "      Stopping dev server (better-sqlite3 holds an open handle)..."
./scripts/dev-stop.sh | sed 's/^/      /'
if [ -f "$LOCAL_DB" ]; then
  CURRENT_SIZE=$(human_size "$LOCAL_DB")
  echo "      Backing up current dev DB ($CURRENT_SIZE) → $LOCAL_BACKUP"
  cp "$LOCAL_DB" "$LOCAL_BACKUP"
fi
if [ -f "$LOCAL_DB-wal" ] || [ -f "$LOCAL_DB-shm" ]; then
  echo "      Removing stale WAL/SHM files"
  rm -f "$LOCAL_DB-wal" "$LOCAL_DB-shm"
fi
echo "      Moving snapshot → $LOCAL_DB"
mv "$LOCAL_SNAPSHOT" "$LOCAL_DB"
echo "      ✓ new dev DB in place ($(human_size "$LOCAL_DB"))"
echo

echo "[6/6] Restarting dev server"
./scripts/dev-start.sh | sed 's/^/      /'
echo

echo "═══════════════════════════════════════════════════════════"
echo "✓ Done. Previous dev DB preserved at:"
echo "  $LOCAL_BACKUP"
echo "═══════════════════════════════════════════════════════════"
