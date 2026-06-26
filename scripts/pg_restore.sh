#!/usr/bin/env bash
# scripts/pg_restore.sh — Restore a PostgreSQL backup from S3
# Usage: ./scripts/pg_restore.sh <s3-key>
# Example: ./scripts/pg_restore.sh backups/postgres/2024-01-15T02-00-00Z.sql.gz
# Required env vars: DATABASE_URL, S3_BACKUP_BUCKET
set -euo pipefail

S3_KEY="${1:?Usage: $0 <s3-key>}"
RESTORE_FILE="/tmp/ajosave_restore.sql.gz"

DB_USER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

echo "[$(date -u)] Downloading s3://${S3_BACKUP_BUCKET}/${S3_KEY}"
aws s3 cp "s3://${S3_BACKUP_BUCKET}/${S3_KEY}" "$RESTORE_FILE"

echo "[$(date -u)] Restoring to ${DB_NAME} on ${DB_HOST}:${DB_PORT}"
echo "WARNING: This will DROP and recreate the database. Press Ctrl-C within 5s to abort."
sleep 5

PGPASSWORD="$DB_PASS" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();"

PGPASSWORD="$DB_PASS" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" postgres \
  -c "DROP DATABASE IF EXISTS \"${DB_NAME}\"; CREATE DATABASE \"${DB_NAME}\";"

gunzip -c "$RESTORE_FILE" | PGPASSWORD="$DB_PASS" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

rm -f "$RESTORE_FILE"
echo "[$(date -u)] Restore complete."
