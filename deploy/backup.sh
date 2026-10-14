#!/usr/bin/env bash
#
# Nightly encrypted backup of the PRODUCTION database, run ON THE VPS by cron.
#
# This exists because .github/workflows/db-backup.yml cannot reach it. That
# workflow dumps from a GitHub runner over the public internet, which worked
# while production was on Neon. The VPS Postgres deliberately publishes no
# port, so after the cutover that workflow still succeeds every night -- while
# backing up STAGING. A green tick on the wrong database is worse than a red
# one, so production is backed up from inside the host instead.
#
# Same shape as the workflow it replaces, so a restore is unchanged:
#   custom-format pg_dump -> verified with pg_restore --list -> GPG AES256 ->
#   Backblaze B2. The repo is public and the passphrase is the only thing
#   protecting the dump, so the encryption is not optional.
#
# Install (as root):
#   cp deploy/backup.sh /opt/aegislead/backup.sh && chmod 700 /opt/aegislead/backup.sh
#   # credentials, mode 600, root-owned:
#   cat > /opt/aegislead/.env.backup <<'EOF'
#   BACKUP_PASSPHRASE=<long random; KEEP A COPY SOMEWHERE ELSE>
#   B2_BACKUP_BUCKET=<bucket name>
#   B2_BACKUP_KEY_ID=<application key id>
#   B2_BACKUP_APP_KEY=<application key secret>
#   EOF
#   chmod 600 /opt/aegislead/.env.backup
#   # 02:00 IST == 20:30 UTC, matching the old workflow's schedule:
#   ( crontab -l 2>/dev/null; echo '30 20 * * * /opt/aegislead/backup.sh >> /var/log/aegislead-backup.log 2>&1' ) | crontab -
#
# Restore:
#   gpg --decrypt aegislead-db-<stamp>.dump.gpg > db.dump
#   docker compose -f /opt/aegislead/docker-compose.prod.yml exec -T db \
#     pg_restore --no-owner --no-acl -U <user> -d <db> < db.dump

set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/aegislead}"
WORK_DIR="$(mktemp -d)"
# Removes the plaintext dump even if this script dies partway through. Without
# it a failed run can leave an unencrypted copy of the whole database on disk.
trap 'rm -rf "$WORK_DIR"' EXIT

cd "$STACK_DIR"

# Read with sed rather than sourcing, for the same reason deploy.sh does: a
# value containing shell metacharacters would otherwise be executed.
env_value() { sed -n "s/^$1=//p" "$2" | tail -1; }

for f in .env.production .env.backup; do
  [ -f "$STACK_DIR/$f" ] || { echo "FATAL: $STACK_DIR/$f is missing" >&2; exit 1; }
done

PG_USER="$(env_value POSTGRES_USER "$STACK_DIR/.env.production")"
PG_DB="$(env_value POSTGRES_DB "$STACK_DIR/.env.production")"
PASSPHRASE="$(env_value BACKUP_PASSPHRASE "$STACK_DIR/.env.backup")"
B2_BUCKET="$(env_value B2_BACKUP_BUCKET "$STACK_DIR/.env.backup")"
B2_KEY_ID="$(env_value B2_BACKUP_KEY_ID "$STACK_DIR/.env.backup")"
B2_APP_KEY="$(env_value B2_BACKUP_APP_KEY "$STACK_DIR/.env.backup")"

for name in PG_USER PG_DB PASSPHRASE B2_BUCKET B2_KEY_ID B2_APP_KEY; do
  [ -n "${!name}" ] || { echo "FATAL: $name resolved empty" >&2; exit 1; }
done

STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
DUMP="$WORK_DIR/db.dump"
ENCRYPTED="$WORK_DIR/aegislead-db-$STAMP.dump.gpg"

echo "==> [$(date -u +%FT%TZ)] Dumping $PG_DB"
# -T because cron has no TTY. pg_dump runs inside the container, so its version
# always matches the server and no client packages are needed on the host.
docker compose --env-file "$STACK_DIR/.env.production" \
  -f "$STACK_DIR/docker-compose.prod.yml" exec -T db \
  pg_dump -U "$PG_USER" -d "$PG_DB" --format=custom --no-owner --no-acl > "$DUMP"

# A dump that cannot be listed cannot be restored. Checked before it is
# encrypted and shipped, so a corrupt one never silently replaces a good one.
echo "==> Verifying dump"
docker compose --env-file "$STACK_DIR/.env.production" \
  -f "$STACK_DIR/docker-compose.prod.yml" exec -T db \
  pg_restore --list < "$DUMP" > /dev/null

echo "==> Encrypting ($(du -h "$DUMP" | cut -f1) plaintext)"
printf '%s' "$PASSPHRASE" | gpg --batch --yes \
  --pinentry-mode loopback --passphrase-fd 0 \
  --symmetric --cipher-algo AES256 \
  --output "$ENCRYPTED" "$DUMP"
rm -f "$DUMP"

echo "==> Uploading daily/$(basename "$ENCRYPTED") to B2"
# Content-MD5 makes B2 reject the object unless every byte arrived intact --
# worth it because a write-only key cannot read the object back to check.
AWS_ACCESS_KEY_ID="$B2_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$B2_APP_KEY" \
AWS_DEFAULT_REGION=us-east-005 \
AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
docker run --rm \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION \
  -e AWS_REQUEST_CHECKSUM_CALCULATION -e AWS_RESPONSE_CHECKSUM_VALIDATION \
  -v "$WORK_DIR:/data:ro" \
  amazon/aws-cli:2 s3api put-object \
    --endpoint-url https://s3.us-east-005.backblazeb2.com \
    --bucket "$B2_BUCKET" \
    --key "daily/$(basename "$ENCRYPTED")" \
    --body "/data/$(basename "$ENCRYPTED")" \
    --content-md5 "$(openssl dgst -md5 -binary "$ENCRYPTED" | base64)" \
  > /dev/null

echo "==> [$(date -u +%FT%TZ)] Backed up daily/$(basename "$ENCRYPTED")"
