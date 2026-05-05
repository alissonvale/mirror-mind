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

cleanup_remote() {
  ssh "$VPS" "rm -f $REMOTE_SNAPSHOT" 2>/dev/null || true
}
trap cleanup_remote EXIT

echo "→ Creating online snapshot on $VPS"
ssh "$VPS" "sqlite3 $REMOTE_DB \".backup $REMOTE_SNAPSHOT\""

echo "→ Verifying snapshot integrity"
ssh "$VPS" "sqlite3 $REMOTE_SNAPSHOT 'PRAGMA integrity_check;'" | grep -q "^ok$" || {
  echo "✗ Snapshot failed integrity check"
  exit 1
}

echo "→ Downloading snapshot"
scp -q "$VPS:$REMOTE_SNAPSHOT" "$LOCAL_SNAPSHOT"

echo "→ Stopping dev server"
./scripts/dev-stop.sh

if [ -f "$LOCAL_DB" ]; then
  echo "→ Backing up current dev DB → $LOCAL_BACKUP"
  cp "$LOCAL_DB" "$LOCAL_BACKUP"
fi

echo "→ Removing stale WAL/SHM files"
rm -f "$LOCAL_DB-wal" "$LOCAL_DB-shm"

echo "→ Replacing dev DB with prod snapshot"
mv "$LOCAL_SNAPSHOT" "$LOCAL_DB"

echo "→ Restarting dev server"
./scripts/dev-start.sh

echo ""
echo "✓ Prod DB pulled into dev."
echo "  Previous dev DB: $LOCAL_BACKUP"
