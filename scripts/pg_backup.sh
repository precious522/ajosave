#!/usr/bin/env bash
# scripts/pg_backup.sh — Daily PostgreSQL backup to S3
# Required env vars: DATABASE_URL, S3_BACKUP_BUCKET, AWS_DEFAULT_REGION
# Optional:          BACKUP_RETENTION_DAYS (default: 30)
set -euo pipefail

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="/tmp/ajosave_${TIMESTAMP}.sql.gz"

# Parse DATABASE_URL → pg_dump args
# Expected format: postgresql://user:password@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

echo "[$(date -u)] Starting backup of ${DB_NAME} on ${DB_HOST}:${DB_PORT}"

PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
  --no-password --format=plain | gzip > "$BACKUP_FILE"

S3_KEY="backups/postgres/${TIMESTAMP}.sql.gz"
aws s3 cp "$BACKUP_FILE" "s3://${S3_BACKUP_BUCKET}/${S3_KEY}" \
  --storage-class STANDARD_IA

echo "[$(date -u)] Uploaded to s3://${S3_BACKUP_BUCKET}/${S3_KEY}"

# Enforce retention policy
CUTOFF=$(date -u -d "${RETENTION_DAYS} days ago" +"%Y-%m-%dT%H-%M-%SZ" 2>/dev/null \
  || date -u -v-"${RETENTION_DAYS}"d +"%Y-%m-%dT%H-%M-%SZ")

aws s3 ls "s3://${S3_BACKUP_BUCKET}/backups/postgres/" \
  | awk '{print $4}' \
  | while read -r key; do
      if [[ "$key" < "${CUTOFF}" ]]; then
        aws s3 rm "s3://${S3_BACKUP_BUCKET}/backups/postgres/${key}"
        echo "[$(date -u)] Deleted expired backup: ${key}"
      fi
    done

rm -f "$BACKUP_FILE"
echo "[$(date -u)] Backup complete."
