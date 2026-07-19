#!/bin/bash
# Domovník — PostgreSQL database backup script.
# Usage: ./backup-db.sh [backup_dir]
#
# Creates a timestamped pg_dump in the specified directory (default: ./backups).
# Designed for cron: 0 2 * * * /app/scripts/backup-db.sh /var/backups/domovnik

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="${BACKUP_DIR}/domovnik-${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup to ${BACKUP_FILE}..."

PGPASSWORD="${DB_PASSWORD}" pg_dump \
  -h "${DB_HOST:-postgres}" \
  -U "${DB_USER:-domovnik}" \
  -d "${DB_NAME:-domovnik}" \
  --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup complete: $(du -h "$BACKUP_FILE" | cut -f1)"

# Cleanup old backups
find "$BACKUP_DIR" -name "domovnik-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

echo "[$(date)] Cleaned backups older than ${RETENTION_DAYS} days."