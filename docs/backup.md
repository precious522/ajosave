# PostgreSQL Backup & Restore

## Overview

Daily automated backups run at **02:00 UTC** via GitHub Actions, uploading compressed dumps to S3 in a separate region from the application. Backups are retained for **30 days**.

## Required Secrets (GitHub → Settings → Secrets)

| Secret | Description |
|---|---|
| `DATABASE_URL` | Production PostgreSQL connection string |
| `AWS_ACCESS_KEY_ID` | IAM key with `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, `s3:DeleteObject` |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret |
| `AWS_BACKUP_REGION` | S3 region for backups (must differ from app region) |
| `S3_BACKUP_BUCKET` | Bucket name, e.g. `ajosave-db-backups-eu-west-1` |

## S3 Bucket Setup

```bash
# Create bucket in a separate region (e.g. eu-west-1 if app is in us-east-1)
aws s3api create-bucket \
  --bucket ajosave-db-backups-eu-west-1 \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket ajosave-db-backups-eu-west-1 \
  --versioning-configuration Status=Enabled

# Block all public access
aws s3api put-public-access-block \
  --bucket ajosave-db-backups-eu-west-1 \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

## Manual Backup

```bash
export DATABASE_URL=postgresql://user:pass@host:5432/ajosave
export S3_BACKUP_BUCKET=ajosave-db-backups-eu-west-1
export AWS_DEFAULT_REGION=eu-west-1

chmod +x scripts/pg_backup.sh
./scripts/pg_backup.sh
```

## Restore Procedure

1. List available backups:
   ```bash
   aws s3 ls s3://${S3_BACKUP_BUCKET}/backups/postgres/ --recursive
   ```

2. Restore from a specific backup:
   ```bash
   export DATABASE_URL=postgresql://user:pass@host:5432/ajosave
   export S3_BACKUP_BUCKET=ajosave-db-backups-eu-west-1
   export AWS_DEFAULT_REGION=eu-west-1

   chmod +x scripts/pg_restore.sh
   ./scripts/pg_restore.sh backups/postgres/2024-01-15T02-00-00Z.sql.gz
   ```

   > **Warning:** The restore script drops and recreates the target database. It prompts with a 5-second abort window.

3. Verify the restore:
   ```bash
   psql "$DATABASE_URL" -c "\dt"
   psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM circles;"
   ```

## Retention Policy

Backups older than 30 days are automatically deleted by `pg_backup.sh` on each run. The S3 lifecycle policy below provides a second layer of enforcement:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket ajosave-db-backups-eu-west-1 \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-old-backups",
      "Status": "Enabled",
      "Filter": {"Prefix": "backups/postgres/"},
      "Expiration": {"Days": 30}
    }]
  }'
```

## Monitoring

The GitHub Actions workflow (`backup.yml`) runs daily and marks the job as failed if the backup does not complete. Configure GitHub notifications or a status check integration to alert on failure.
