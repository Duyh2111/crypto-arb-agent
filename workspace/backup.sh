#!/usr/bin/env bash
# Backup logs and daily reports to a timestamped archive.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ARCHIVE="$BACKUP_DIR/arb-backup-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

tar -czf "$ARCHIVE" \
  --exclude='logs/.risk-state.json' \
  logs/ reports/ 2>/dev/null || true

echo "✅ Backup saved: $ARCHIVE"

# Keep only last 30 backups
ls -t "$BACKUP_DIR"/arb-backup-*.tar.gz 2>/dev/null | tail -n +31 | xargs rm -f --
