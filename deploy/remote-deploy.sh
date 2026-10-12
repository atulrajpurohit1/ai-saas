#!/usr/bin/env bash
#
# Runs ON THE VPS. Called by .github/workflows/deploy-production.yml over SSH:
#
#   /opt/aegislead/remote-deploy.sh <backend-image> <frontend-image>
#
# It lives on the server rather than inside the workflow so that a deploy can
# also be driven by hand (or reverted) when GitHub is unavailable, and so the
# commands are reviewable in one place with the stack they operate on.
#
# Order matters: migrate BEFORE swapping the containers, so the new code never
# runs against the old schema. That only holds if migrations stay
# backward-compatible (add columns, do not drop or rename in the same release),
# because during the swap the OLD code is briefly running against the NEW
# schema. Expand first, contract in a later release.

set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/aegislead}"
COMPOSE_FILE="$STACK_DIR/docker-compose.prod.yml"
ENV_FILE="$STACK_DIR/.env.production"
HEALTH_URL="${HEALTH_URL:-https://dashboard.aegislead.co/api/health/ready}"

BACKEND_IMAGE_NEW="${1:?usage: remote-deploy.sh <backend-image> <frontend-image>}"
FRONTEND_IMAGE_NEW="${2:?usage: remote-deploy.sh <backend-image> <frontend-image>}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[ -f "$COMPOSE_FILE" ] || die "$COMPOSE_FILE not found"
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found"

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# What is running now, so a failed deploy can be put back.
BACKEND_IMAGE_OLD="$(grep -E '^BACKEND_IMAGE=' "$ENV_FILE" | cut -d= -f2-)"
FRONTEND_IMAGE_OLD="$(grep -E '^FRONTEND_IMAGE=' "$ENV_FILE" | cut -d= -f2-)"
log "current: $BACKEND_IMAGE_OLD / $FRONTEND_IMAGE_OLD"
log "deploying: $BACKEND_IMAGE_NEW / $FRONTEND_IMAGE_NEW"

set_images() {
  local backend="$1" frontend="$2"
  # In place, preserving the file's 600 permissions and ownership.
  sed -i "s|^BACKEND_IMAGE=.*|BACKEND_IMAGE=$backend|" "$ENV_FILE"
  sed -i "s|^FRONTEND_IMAGE=.*|FRONTEND_IMAGE=$frontend|" "$ENV_FILE"
}

rollback() {
  log "rolling back to $BACKEND_IMAGE_OLD / $FRONTEND_IMAGE_OLD"
  set_images "$BACKEND_IMAGE_OLD" "$FRONTEND_IMAGE_OLD"
  compose up -d --remove-orphans
  # Deliberately NOT reverting migrations: `prisma migrate` has no down
  # migrations here, and guessing at a schema rollback on live data is how
  # data gets lost. The previous image is expected to tolerate the new schema
  # (see the expand-then-contract note above). If it cannot, this needs a
  # human and a backup, not a script.
  log "rolled back; the database is still on the new migration state"
}

set_images "$BACKEND_IMAGE_NEW" "$FRONTEND_IMAGE_NEW"

log "pulling images"
if ! compose pull backend frontend; then
  set_images "$BACKEND_IMAGE_OLD" "$FRONTEND_IMAGE_OLD"
  die "pull failed; nothing was changed"
fi

# Postgres must be up for migrations, and it is not restarted by a deploy.
compose up -d postgres redis

log "applying migrations"
# A one-off container on the new image: migrations run from inside the compose
# network, so the database keeps its no-published-port isolation. --rm so a
# failed run leaves nothing behind.
if ! compose run --rm --no-deps backend npx prisma migrate deploy; then
  set_images "$BACKEND_IMAGE_OLD" "$FRONTEND_IMAGE_OLD"
  die "migrations failed; containers were left untouched and still serve the old release"
fi

log "starting new containers"
compose up -d --remove-orphans

log "waiting for $HEALTH_URL"
# ~2 minutes: long enough for Nest to boot and connect, short enough that a
# broken release is rolled back before many users see it.
for attempt in $(seq 1 24); do
  if curl --fail --silent --show-error --max-time 10 "$HEALTH_URL" > /dev/null; then
    log "healthy after ${attempt} attempt(s)"
    log "pruning images older than 72h"
    docker image prune --all --force --filter 'until=72h' > /dev/null || true
    log "deploy complete: $BACKEND_IMAGE_NEW"
    exit 0
  fi
  sleep 5
done

log "health check never passed"
compose logs --tail 80 backend || true
rollback
exit 1
