#!/bin/bash
# Domovník — PostgreSQL database restore script.
# Usage: ./restore-db.sh <backup_file.sql.gz>
#
# Restores a pg_dump backup to the configured database.
# WARNING: This will overwrite existing data!

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo "Example: $0 ./backups/domovnik-2026-07-19T02-00-00Z.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠ This will overwrite the database '${DB_NAME:-domovnik}' on '${DB_HOST:-postgres}'."
echo "   Backup file: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
read -r -p "   Continue? [y/N] " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

echo "[$(date)] Starting restore from ${BACKUP_FILE}..."

gunzip -c "$BACKUP_FILE" | PGPASSWORD="${DB_PASSWORD}" psql \
  -h "${DB_HOST:-postgres}" \
  -U "${DB_USER:-domovnik}" \
  -d "${DB_NAME:-domovnik}"

echo "[$(date)] ✅ Restore complete."
echo ""
echo "Run Prisma migrations if needed:"
echo "  cd apps/server && npx prisma migrate deploy"