#!/usr/bin/env bash
#
# Nightly encrypted backup of the PRODUCTION database on the VPS.
#
# This replaces .github/workflows/db-backup.yml for production: that workflow
# connects to Neon from a GitHub runner, which only works because Neon is on
# the public internet. The VPS Postgres is not, and should not be -- so the
# dump is taken here, on the box, and pushed out.
#
# Same scheme as the workflow it replaces, so the restore instructions are
# unchanged: custom-format dump, verified with pg_restore --list, encrypted
# with GPG (AES256) before it leaves the machine, uploaded under daily/ in the
# Backblaze B2 bucket. The B2 key should be able to write but not delete, so a
# compromised VPS cannot destroy the backup history.
#
# Install (as root):
#   cp deploy/backup-db.sh /opt/aegislead/backup-db.sh
#   chmod 750 /opt/aegislead/backup-db.sh
#   crontab -e   ->   30 20 * * * /opt/aegislead/backup-db.sh >> /var/log/aegislead-backup.log 2>&1
#   (20:30 UTC = 02:00 IST, matching the old workflow.)
#
# Restore:
#   gpg --decrypt aegislead-db-<stamp>.dump.gpg > db.dump
#   docker compose -f /opt/aegislead/docker-compose.prod.yml cp db.dump postgres:/tmp/db.dump
#   docker compose -f /opt/aegislead/docker-compose.prod.yml exec -T postgres \
#     pg_restore --no-owner --no-acl --clean --if-exists \
#     --dbname "$POSTGRES_DB" --username "$POSTGRES_USER" /tmp/db.dump

set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/aegislead}"
COMPOSE_FILE="$STACK_DIR/docker-compose.prod.yml"
ENV_FILE="$STACK_DIR/.env.production"
BACKUP_DIR="${BACKUP_DIR:-$STACK_DIR/backups}"
# How many dumps to keep on the VPS itself. B2 holds the long history; these
# are only here to make a same-day restore fast, and they are the reason the
# disk fills if nobody prunes them.
LOCAL_KEEP="${LOCAL_KEEP:-7}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[ -f "$COMPOSE_FILE" ] || die "$COMPOSE_FILE not found (set STACK_DIR)"
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found"

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE must be set in $ENV_FILE}"
: "${B2_BACKUP_BUCKET:?B2_BACKUP_BUCKET must be set in $ENV_FILE}"
: "${B2_BACKUP_KEY_ID:?B2_BACKUP_KEY_ID must be set in $ENV_FILE}"
: "${B2_BACKUP_APP_KEY:?B2_BACKUP_APP_KEY must be set in $ENV_FILE}"
POSTGRES_DB="${POSTGRES_DB:-aegislead}"
POSTGRES_USER="${POSTGRES_USER:-aegislead}"
B2_ENDPOINT="${B2_ENDPOINT:-https://s3.us-east-005.backblazeb2.com}"

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y-%m-%dT%H%MZ)"
plain="$BACKUP_DIR/aegislead-db-$stamp.dump"
encrypted="$plain.gpg"

# The dump is taken INSIDE the container so pg_dump always matches the server
# version; the host needs no postgres-client package at all.
log "dumping $POSTGRES_DB"
compose exec -T postgres pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format=custom --no-owner --no-acl \
  --file=/tmp/backup.dump

# Refuse to ship an obviously broken dump, exactly as the old workflow did.
log "verifying dump"
compose exec -T postgres pg_restore --list /tmp/backup.dump > /dev/null

compose exec -T postgres cat /tmp/backup.dump > "$plain"
compose exec -T postgres rm -f /tmp/backup.dump
[ -s "$plain" ] || die "dump is empty"

log "encrypting ($(du -h "$plain" | cut -f1) raw)"
printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes \
  --pinentry-mode loopback --passphrase-fd 0 \
  --symmetric --cipher-algo AES256 \
  --output "$encrypted" "$plain"
# The unencrypted copy never stays on disk: the whole point of the passphrase
# is that a stolen disk or a leaked backup file is useless on its own.
shred -u "$plain" 2>/dev/null || rm -f "$plain"

log "uploading daily/$(basename "$encrypted") to $B2_BACKUP_BUCKET"
# Run the AWS CLI from a container so the host stays free of Python tooling.
# Content-MD5 makes B2 reject a partial upload, which a write-only key could
# not detect afterwards.
md5="$(openssl dgst -md5 -binary "$encrypted" | base64)"
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$B2_BACKUP_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$B2_BACKUP_APP_KEY" \
  -e AWS_DEFAULT_REGION=us-east-005 \
  -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
  -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
  -v "$BACKUP_DIR:/backups:ro" \
  amazon/aws-cli:latest s3api put-object \
  --endpoint-url "$B2_ENDPOINT" \
  --bucket "$B2_BACKUP_BUCKET" \
  --key "daily/$(basename "$encrypted")" \
  --body "/backups/$(basename "$encrypted")" \
  --content-md5 "$md5" > /dev/null

log "pruning local copies beyond the newest $LOCAL_KEEP"
ls -1t "$BACKUP_DIR"/aegislead-db-*.dump.gpg 2>/dev/null \
  | tail -n "+$((LOCAL_KEEP + 1))" \
  | xargs -r rm -f

log "done: daily/$(basename "$encrypted")"
