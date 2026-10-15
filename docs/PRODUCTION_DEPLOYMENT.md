# Production deployment runbook

Moving production to the GoDaddy VPS and keeping Vercel + Render as staging.

| | Production | Staging |
|---|---|---|
| Host | GoDaddy VPS, Docker Compose | Vercel (app) + Render (API) |
| Domain | `dashboard.aegislead.co` | `staging.aegislead.co` |
| Database | Postgres 18 on the VPS | the existing Neon instance |
| Deploys on | push to `production` | push to `main` (automatic) |
| Stripe | live keys | test keys |

Both environments serve the app and the API on **one origin**: `/api` goes to
NestJS, everything else to Next.js. On the VPS that is Caddy; on Vercel it is a
rewrite in `frontend/vercel.json`. Browser API calls are therefore same-origin
and CORS never applies.

Work through the phases in order. Phases 1-4 change nothing user-visible: the
live site stays on Vercel until Phase 5.

---

## Phase 1 — Prepare the VPS

SSH in as root.

### 1.1 Base packages and a non-root deploy user

```bash
apt-get update && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg openssl ufw fail2ban

# CI deploys as this user. It needs no sudo -- membership of `docker` is enough
# to run the stack, and that is deliberately the only privilege the deploy key
# carries.
adduser --disabled-password --gecos "" deploy
```

### 1.2 Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp      # HTTP/3; harmless if unused
ufw --force enable
```

> **Know this about ufw and Docker:** Docker writes its own iptables rules and
> publishing a port **bypasses ufw entirely** — a published port is reachable
> from the internet even with the firewall "on". `docker-compose.prod.yml`
> publishes only 80/443 (Caddy) for exactly this reason; Postgres and both app
> containers are reachable only on the internal Compose network. If you ever
> add a `ports:` entry, you are opening it to the world regardless of ufw.

### 1.3 Docker

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

usermod -aG docker deploy
docker --version && docker compose version
```

### 1.4 Stack directory

```bash
mkdir -p /opt/aegislead
chown deploy:deploy /opt/aegislead
chmod 750 /opt/aegislead
```

---

## Phase 2 — Production secrets

**Generate these on the VPS.** Not on your laptop, not in a chat window — a
secret that never leaves the host cannot leak from anywhere else.

```bash
# JWT signing keys. Must be >=32 chars and MUST DIFFER from each other:
# sharing one key lets an access token be replayed as a refresh token.
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -d '\n')"

# Encrypts stored CRM OAuth tokens at rest.
echo "CRM_TOKEN_SECRET=$(openssl rand -base64 48 | tr -d '\n')"

# Postgres password. Restricted to alphanumerics on purpose: it goes into
# DATABASE_URL, where : / ? # [ ] @ would need percent-encoding -- which fails
# as a confusing authentication error rather than an obvious parse error.
echo "POSTGRES_PASSWORD=$(openssl rand -base64 36 | tr -dc 'A-Za-z0-9' | head -c 40)"
```

These are **new** secrets, not copies of staging's. Reusing staging's JWT keys
would make a token minted on staging valid in production.

Now build the file:

```bash
su - deploy
cd /opt/aegislead
# Copy deploy/.env.production.example from the repo, then fill it in. Every
# variable there is annotated with what breaks if it is wrong.
nano .env.production
chmod 600 .env.production
```

Carry over from the current Render service: `GEMINI_API_KEY`, `BREVO_API_KEY`,
`EMAIL_FROM`, all `S3_*`, `BLACKPEARL_*`. Use **live** Stripe keys and
**live-mode** price ids — a test-mode price id is rejected by a live key.

Check before moving on:

- `NODE_ENV=production`. Anything else logs every signup and password-reset OTP
  in cleartext.
- `DATABASE_URL` host is `db`, the Compose service name — not a public host.
- `SITE_DOMAIN` is your **temporary** domain for now (Phase 4).
- `ALLOW_VERCEL_PREVIEW_ORIGINS` is absent. It would trust every
  `ai-saas-*.vercel.app` origin, a namespace nobody controls.

---

## Phase 3 — GitHub configuration

### 3.1 Deploy key

On your machine, a key **for this workflow only** — never your personal key:

```bash
ssh-keygen -t ed25519 -C github-actions-deploy -f ~/.ssh/aegislead_deploy -N ""
```

Install the public half on the VPS, as the `deploy` user:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<contents of aegislead_deploy.pub>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3.2 Repository variables and secrets

Settings → Secrets and variables → Actions.

**Variables:**

| Name | Value |
|---|---|
| `VPS_HOST` | the VPS IP |
| `VPS_USER` | `deploy` |

**Secrets:**

| Name | Value |
|---|---|
| `VPS_SSH_KEY` | the full **private** key (`~/.ssh/aegislead_deploy`), header and footer lines included |
| `VPS_SSH_HOST_KEY` | output of `ssh-keyscan -t ed25519 <VPS_HOST>` — the whole line |

Pinning the host key is what lets the workflow use
`StrictHostKeyChecking=yes`. Without it, a hijacked DNS entry or IP could
impersonate the VPS and harvest the deploy session.

### 3.3 Container registry

The deploy pulls from GHCR. The repo is already public, so the images expose
nothing further — the simplest arrangement is to make both packages public so
the VPS needs no registry credential at all.

After the first successful image build, open each package (`ai-saas-backend`,
`ai-saas-frontend`) → Package settings → Change visibility → Public.

Prefer them private? Create a read-only PAT with `read:packages` and run
`docker login ghcr.io` once as `deploy` on the VPS. That is one more credential
to rotate, for no gain while the source itself is public.

### 3.4 The production branch

```bash
git checkout -b production main
git push -u origin production
```

This triggers the first real deploy, so do it **after** Phase 2 is complete.

---

## Phase 4 — First deploy, on a temporary domain

Deploy and test the whole stack while the live site is still on Vercel.

This works because the frontend image bakes `NEXT_PUBLIC_API_URL=/api` — a
**relative** value, so one image serves correctly from any hostname. Nothing
needs rebuilding when you later switch domains.

### 4.1 Temporary DNS

At GoDaddy, add an A record: `prod-test` → the VPS IP, TTL 600.
Set `SITE_DOMAIN=prod-test.aegislead.co` in `.env.production`.

### 4.2 Put the stack files in place

```bash
# from the repo, on your machine
scp deploy/docker-compose.prod.yml deploy/Caddyfile deploy/deploy.sh \
  deploy@<VPS_HOST>:/opt/aegislead/
```

### 4.3 Deploy

Push to `production` (3.4) and watch the Actions run, or by hand:

```bash
cd /opt/aegislead && chmod +x deploy.sh && ./deploy.sh latest
```

`deploy.sh` validates the Caddyfile before touching the running stack, applies
all 64 Prisma migrations through the one-shot `migrate` service, then polls the
deep health endpoint and **rolls back** if it does not come up.

The `Verify the public origin` step in CI will fail at this stage, because it
checks `dashboard.aegislead.co`, which is still Vercel. That is expected until
Phase 5 — everything before it passing is the signal that matters.

### 4.4 Verify

```bash
curl -s https://prod-test.aegislead.co/api/health
# {"status":"ok","database":"ok","databaseLatencyMs":2,...}

docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs migrate
```

Read the backend's boot warnings — the environment check names every feature
that is silently misconfigured:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  logs backend | grep -i EnvironmentCheck
```

### 4.5 The first admin account

`prisma/seed-admin.ts` now requires the credentials in the environment and
refuses to run without them:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong password>' \
  npx ts-node prisma/seed-admin.ts
```

> It previously hardcoded `admin@aisaascrm.com` / `Admin123!`. Because this
> repository is public, that was a working published login for every
> deployment it had been run against — production included. The account was
> found live on 2026-10-16 and its password rotated. If you are reading this
> while recovering an old backup, that credential may still work in it.

Create the first admin through the app's own signup flow at
`https://prod-test.aegislead.co`. Brevo is configured, so the OTP email arrives
normally. Then verify in the browser: log in, load a few pages, create a
record, and confirm an upload reaches B2.

---

## Phase 5 — Cut `dashboard.aegislead.co` over

Do this when Phase 4 is green. There are no paying users as of the cutover, so
no maintenance window is needed.

1. **Lower the TTL** on the existing `dashboard` record to 600 and wait for the
   old TTL to expire. Skip this and some clients keep resolving to Vercel for
   however long the old TTL was — often an hour.
2. **Free the hostname in Vercel:** Project → Settings → Domains → remove
   `dashboard.aegislead.co`. Leave it attached and Vercel keeps serving it.
3. **Repoint DNS** at GoDaddy: `dashboard` A record → the VPS IP.
4. **Update the VPS:** set `SITE_DOMAIN=dashboard.aegislead.co`, and
   `FRONTEND_URL`, `CORS_ORIGINS`, `BILLING_RETURN_URL` to the live origin.
   Then `./deploy.sh <current-sha>`. Caddy issues the certificate on first
   request, so DNS must already resolve — a failed ACME challenge repeated a
   few times hits Let's Encrypt rate limits.
5. **Verify:** `curl -sI https://dashboard.aegislead.co/api/health`
6. **Remove** the `prod-test` DNS record.

### 5.1 Re-register external callbacks

These point at the backend origin and fail silently if not updated:

- **Stripe webhook** → a **new** endpoint at
  `https://dashboard.aegislead.co/api/billing/webhook/stripe`. Copy its own
  signing secret into `STRIPE_WEBHOOK_SECRET`; staging's will not verify these
  requests. Without it, payments succeed but nothing is provisioned — credits
  never arrive and subscriptions never activate, because the handler rejects
  every unsigned request. Events needed: `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.payment_failed`,
  `charge.refunded`, `charge.dispute.created`.
- **CRM OAuth redirect URIs** → in each vendor's app settings, add
  `https://dashboard.aegislead.co/api/crm-connectors/<provider>/callback`.
  They must match character for character.

---

## Phase 6 — Point staging at `staging.aegislead.co`

1. GoDaddy: `staging` CNAME → `cname.vercel-dns.com`.
2. Vercel: add `staging.aegislead.co` to the project.
3. Render (backend env): set `FRONTEND_URL`, `CORS_ORIGINS` and
   `BILLING_RETURN_URL` to `https://staging.aegislead.co`.

4. **Now** flip `frontend/vercel.json` to the single-origin setup — change
   `env.NEXT_PUBLIC_API_URL` from the Render URL to `"/api"` and merge.

That flip is deliberately left until this phase. `vercel.json` already carries
the `/api/:path*` rewrite, but the app keeps calling Render directly until the
value above changes, so nothing routes through the rewrite yet.

The reason for the delay: until Phase 5, Vercel serves **production**. Flipping
the value earlier would have rerouted the live site's API calls through
Vercel's proxy as a side effect of staging preparation, with no staging
environment to test it on, because staging was production. Two things to check
the first time traffic does go through the rewrite, since Vercel's proxy sits
in a path that previously went straight to Render:

- a large upload (audio transcription allows up to 25 MB) — confirm Vercel
  does not cap the request body below what the app accepts;
- a slow AI generation — confirm the proxy does not time out before the
  backend answers.

If either fails, revert `NEXT_PUBLIC_API_URL` to the absolute Render URL.
Staging then uses two origins while production stays single-origin, which is
a cosmetic difference between the environments and nothing more.

Because Vercel performs the rewrite **server-side**, those requests reach
Render with no `Origin` header and are allowed by the non-browser branch of
the CORS check.

`render.yaml` is deliberately untouched: it currently describes a *frontend*
service, duplicating Vercel, and editing it could alter Blueprint-managed
services. Make the Render changes in its dashboard.

---

## Phase 7 — Uptime monitoring

Two layers, because they fail differently.

### 7.1 Hosted monitor (primary)

UptimeRobot (free: 50 monitors, 5-minute checks) or Better Stack (free: 10
monitors, 3-minute checks, better alert routing). Configure:

| Setting | Value |
|---|---|
| URL | `https://dashboard.aegislead.co/api/health` |
| Interval | as low as the plan allows |
| Expect | HTTP 200 |
| Alert after | 2 consecutive failures |
| Notify | email **and** phone push/SMS |

Point it at `/api/health`, **not** at the site root or `/api`. The deep
endpoint round-trips Postgres and returns 503 when it cannot reach it. The bare
`GET /api` route returns 200 even with the database down — exactly the outage
you most want to hear about. Enable the provider's SSL-expiry alert too.

### 7.2 `.github/workflows/uptime.yml` (safety net)

Already in the repo. Every ~5 minutes it probes the same endpoint three times
(so one dropped request pages nobody), and on sustained failure opens a GitHub
issue — which emails everyone watching — closing it again on recovery. It also
warns when the TLS certificate is within 14 days of expiry, catching Caddy's
auto-renewal having quietly stopped.

It is a safety net, not the primary: GitHub states scheduled workflows are
best-effort and they are routinely delayed 5-20 minutes, and a monitor running
on GitHub cannot tell you that GitHub is what is down.

---

## Phase 8 — Backups

> **The trap:** `.github/workflows/db-backup.yml` dumps from a GitHub runner
> over the public internet. That worked while production was on Neon. The VPS
> Postgres publishes no port, so after the cutover **that workflow keeps
> passing every night while backing up staging.** A green tick on the wrong
> database is worse than a red one.

Install the host-side backup, which dumps from inside the Compose network:

```bash
# as root
cp deploy/backup.sh /opt/aegislead/backup.sh
chmod 700 /opt/aegislead/backup.sh
nano /opt/aegislead/.env.backup   # see the header of backup.sh for the keys
chmod 600 /opt/aegislead/.env.backup

# 20:30 UTC == 02:00 IST, matching the old schedule
( crontab -l 2>/dev/null; \
  echo '30 20 * * * /opt/aegislead/backup.sh >> /var/log/aegislead-backup.log 2>&1' ) | crontab -
```

Run it once by hand and confirm the object lands in B2. Then **test a restore**
— an untested backup is a hope, not a backup.

Keep `db-backup.yml` if you want staging backed up; just be clear it is no
longer production's.

---

## Rollback

`deploy.sh` rolls back automatically when a deploy fails its health check. By
hand:

```bash
cd /opt/aegislead
cat .current-tag          # the version currently serving
./deploy.sh <previous-sha>
```

**A rollback does not undo a migration.** Prisma migrations have no automatic
down path, so one applied by the failed deploy stays applied. Running older
code against a newer schema is fine for an additive migration and not fine for
a destructive one — a dropped column is gone. Check
`docker compose logs migrate` before trusting a rollback that crossed one.

---

## Common failures

| Symptom | Cause |
|---|---|
| Compose aborts citing an unset variable | `--env-file .env.production` was omitted; Compose reads `.env` by default |
| Caddy will not start, ACME errors | DNS does not resolve to the VPS yet, or 80/443 are blocked |
| Backend exits at boot naming a variable | The environment check refused to start — fix what it names |
| Health returns 503 | Backend is up, Postgres is not: `docker compose logs db` |
| Payment succeeds, no credits | `STRIPE_WEBHOOK_SECRET` is staging's, or the endpoint URL is wrong |
| Logged out right after paying | `BILLING_RETURN_URL` is not the exact origin users sign in on |
| CRM connect fails at callback | Redirect URI does not match the vendor registration exactly |
| `deploy.sh: bad interpreter` | The file has CRLF endings; `.gitattributes` pins LF — check your checkout |
| Every API call 404s after a local Windows build | Git Bash rewrote `NEXT_PUBLIC_API_URL=/api` into `C:/Program Files/Git/api` (MSYS path conversion). Put the value in `frontend/.env.production.local` instead of passing it on the command line. Linux CI and the Docker build are unaffected. |

---

## Appendix — carrying the test data over

The default is a **fresh, empty** production database: migrations plus an admin
created through signup. The test data stays on Neon, which becomes staging's.

To copy it instead, after Phase 4.3 and before Phase 5:

```bash
# On the VPS. Needs the Neon connection string temporarily.
docker run --rm postgres:18-alpine pg_dump "<neon-url>" \
  --format=custom --no-owner --no-acl > /tmp/staging.dump

docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec -T db pg_restore --no-owner --no-acl --data-only \
  -U <POSTGRES_USER> -d <POSTGRES_DB> < /tmp/staging.dump

rm -f /tmp/staging.dump
```

`--data-only`, because `migrate` has already created the schema. Expect
conflicts on any row the migrations seeded themselves.
