#!/usr/bin/env bash
#
# Applies a new image tag to the production stack, verifies it, and rolls back
# if it does not come up.
#
# Runs ON THE VPS. CI copies this file alongside docker-compose.prod.yml and
# the Caddyfile into $STACK_DIR, then invokes it with the tag to deploy:
#
#   ./deploy.sh <image-tag>
#
# Safe to run by hand for a manual rollback:
#
#   ./deploy.sh <previous-sha>

set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/aegislead}"
NEW_TAG="${1:?usage: deploy.sh <image-tag>}"
# Written after each successful deploy so a failure knows what to go back to.
TAG_FILE="$STACK_DIR/.current-tag"

cd "$STACK_DIR"

if [ ! -f .env.production ]; then
  echo "FATAL: $STACK_DIR/.env.production is missing. Create it from" >&2
  echo "       .env.production.example before the first deploy." >&2
  exit 1
fi

compose() {
  docker compose --env-file "$STACK_DIR/.env.production" \
    -f "$STACK_DIR/docker-compose.prod.yml" "$@"
}

# Reads one key out of .env.production without sourcing the file. Sourcing it
# would be shorter and wrong: EMAIL_FROM is legitimately set to a `Name <addr>`
# form, and `. env.production` makes bash parse that `<` as a redirect and die.
# Compose itself parses the file properly; only this script needs two values.
env_value() {
  sed -n "s/^$1=//p" "$STACK_DIR/.env.production" | tail -1
}

PREVIOUS_TAG="$(cat "$TAG_FILE" 2>/dev/null || true)"
echo "==> Deploying $NEW_TAG (previous: ${PREVIOUS_TAG:-none})"

# A Caddyfile syntax error would otherwise be discovered by Caddy refusing to
# start, i.e. with the site already down. Checked before anything is touched.
echo "==> Validating Caddyfile"
docker run --rm \
  -v "$STACK_DIR/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -e SITE_DOMAIN="$(env_value SITE_DOMAIN)" \
  -e ACME_EMAIL="$(env_value ACME_EMAIL)" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile

echo "==> Pulling images"
IMAGE_TAG="$NEW_TAG" compose pull --quiet

# Brings up db, runs migrate to completion, then starts backend/frontend/caddy.
# If `migrate` exits non-zero, Compose refuses to start the backend and this
# command fails here -- before any application code sees a schema it does not
# match.
echo "==> Starting stack"
IMAGE_TAG="$NEW_TAG" compose up -d --remove-orphans

# Verifies the DEEP health endpoint, so this passes only once the backend can
# actually reach Postgres. Checked from inside the container to keep the result
# independent of DNS and TLS, which have their own failure modes and are
# watched by the uptime monitor instead.
echo "==> Waiting for backend health"
healthy=false
for attempt in $(seq 1 30); do
  if IMAGE_TAG="$NEW_TAG" compose exec -T backend \
      curl -fsS http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
    healthy=true
    echo "    backend healthy after ${attempt} attempt(s)"
    break
  fi
  sleep 4
done

if [ "$healthy" != true ]; then
  echo "FATAL: backend did not become healthy within ~120s." >&2
  echo "--- backend logs (last 50) ---" >&2
  IMAGE_TAG="$NEW_TAG" compose logs --tail=50 backend >&2 || true

  if [ -n "$PREVIOUS_TAG" ]; then
    echo "==> Rolling back to $PREVIOUS_TAG" >&2
    # What a rollback does NOT undo: a migration already applied by the
    # `migrate` step stays applied, because Prisma migrations have no
    # automatic down path. Running older code against a newer schema is fine
    # for an additive migration and NOT fine for a destructive one -- a
    # dropped column is gone. Check `compose logs migrate` before trusting a
    # rollback that crossed a migration.
    IMAGE_TAG="$PREVIOUS_TAG" compose up -d --remove-orphans
    echo "    rolled back; the previous version is serving traffic" >&2
  else
    echo "    no previous tag recorded, nothing to roll back to" >&2
  fi
  exit 1
fi

# Only recorded once the deploy is verified, so .current-tag always names a
# version known to have served traffic.
echo "$NEW_TAG" > "$TAG_FILE"

# Two images accumulate per deploy and the disk is 200 GB, so this is tidiness
# rather than necessity. Pruning by age keeps recent rollback targets local;
# an older one is still reachable because every tag remains pullable from GHCR.
echo "==> Pruning dangling images older than 14 days"
docker image prune -af --filter "until=336h" >/dev/null 2>&1 || true

echo "==> Deployed $NEW_TAG successfully"
