# Staging (Vercel + Render + Neon) → Production (GoDaddy VPS) — plan

Target shape:

| | Staging | Production |
|---|---|---|
| Frontend | Vercel (`staging.aegislead.co`) | VPS, behind Nginx (`dashboard.aegislead.co`) |
| Backend | Render (`ai-saas-backend-ulpb.onrender.com`) | VPS, same Nginx under `/api` |
| Database | **Neon** (becomes staging-only) | **Postgres on the VPS**, localhost-only |
| Redis | optional / none | Redis on the VPS (`REDIS_URL` set) |
| Uploads | B2 bucket `...-staging` | B2 bucket `...-prod` (keep object storage, not local disk) |
| Stripe | test keys + test webhook secret | live keys + its own webhook secret |
| Deploy trigger | push to `main` (auto) | push to `production` / tag `v*` (manual approval) |

---

## 0. Decisions to make before any work

1. **Branch strategy** — recommended: `main` = staging (auto-deploys), `production` branch (fast-forward from `main`) = VPS, gated by a GitHub *Environment* with a required reviewer. Hotfix = cherry-pick onto `production`.
2. **How prod is run on the VPS** — recommended: **Docker Compose** (`postgres`, `redis`, `backend`, `frontend`, `nginx`). The repo already has a compose file for Postgres, and it keeps Postgres off the public internet on a private docker network. Alternative (pm2 + system Postgres + system Nginx) is fine but gives you more moving parts to patch.
3. **How CI gets code onto the VPS** — recommended: GitHub Actions builds Docker images → pushes to **GHCR** → SSH into the VPS → `docker compose pull && up -d`. Don't build on the VPS: the Next 16 build will be slow and may OOM on a small droplet. (Second option: a self-hosted GitHub runner on the VPS.)
4. **API routing** — recommended: **same-origin**. Nginx sends `/api/*` to the backend and everything else to Next.js, so prod needs no CORS at all and no separate `api.aegislead.co` certificate. `frontend/src/lib/api.ts` already tolerates a relative value, so `NEXT_PUBLIC_API_URL=/api` works.
5. **Frontend host for staging** — right now BOTH `frontend/vercel.json` and the root `render.yaml` define a frontend deploy. Pick one (Vercel) and delete/retire the other so two staging frontends don't drift.

---

## 1. Things in this repo that must change first (found while reviewing the code)

> **Status:** the items marked ✅ below are implemented. What landed:
> `GET /api/health` and `/api/health/ready`; graceful shutdown and
> `trust proxy` in `main.ts`; `backend/Dockerfile` and `frontend/Dockerfile`;
> `output: "standalone"` with a pinned tracing root; dev Postgres bumped to 18;
> `backend/db.js` deleted; the hard-coded API URL removed from `vercel.json`;
> `.github/workflows/ci.yml` (lint, tests, build, migration-drift check,
> production image build); `.github/workflows/deploy-production.yml` (inert
> until the VPS secrets exist); and the whole `deploy/` directory — production
> compose stack, Nginx config, deploy script, backup script, env template and
> runbook.
>
> Still open, because each needs a decision rather than code: the ~1840
> pre-existing lint violations (CI reports them but does not block), whether
> staging should run the `@Cron` schedulers at all once Neon holds a copy of
> production data, and whether the frontend staging deploy is Vercel or Render
> (`render.yaml` still defines one too).

- ✅ **No health endpoint exists.** `grep` over `src/**` finds no `/api/health`. Deploy verification, Nginx/compose healthchecks, rollback detection and uptime monitoring all need one. Add `GET /api/health` (returns 200 + a `SELECT 1` against Prisma) before building the pipeline.
- ✅ **Postgres version mismatch.** `.github/workflows/db-backup.yml` says Neon runs **Postgres 18**; `backend/docker-compose.yml` pins `postgres:15-alpine`. A `pg_dump` from 18 will **not** restore into 15. The VPS must run Postgres 18 (and the compose file needs updating).
- ✅ **No Dockerfiles.** Need `backend/Dockerfile` (multi-stage: `npm ci` → `prisma generate` → `nest build` → run `node dist/src/main`) and `frontend/Dockerfile` (`output: 'standalone'` in `next.config.ts` to keep the image small). `NEXT_PUBLIC_API_URL` is baked at build time, so it must be a build arg.
- ✅ **No CI at all.** The only workflow is the nightly backup. Nothing lints, type-checks, tests or builds on a PR today.
- ✅ **`backend/db.js` has a hard-coded Postgres password** (`swaroop123`) and is committed to what the backup workflow describes as a **public** repo. It looks dead (Nest uses Prisma). Delete it and rotate anything that password was ever used for.
- ✅ **`frontend/vercel.json` hard-codes `NEXT_PUBLIC_API_URL`** to the Render backend. Move it to Vercel's env settings (per-environment) so staging/prod values aren't in git.
- **Schedulers assume a single instance.** `credit-balance-alert`, `credit-auto-recharge`, `credit-reservation`, `report-delivery` are `@Cron` jobs in-process. Run exactly **one** backend replica on the VPS, or they double-fire (double charges, double emails).
- ✅ **Nginx limits.** Body parser is 10 MB and there are upload env vars for incident **video** evidence, call recordings etc. Set `client_max_body_size` above the largest `*_MAX_MB` you configure, and `proxy_read_timeout 120s` (Gemini/OpenAI calls are slow; the frontend axios timeout is 25 s).
- **Prisma drift risk.** 65 migrations plus a pile of ad-hoc `backend/scripts/apply-*.ts` patch scripts. Run `npx prisma migrate status` against Neon **before** dumping and against the VPS DB **after** restoring; they must match.

---

## 2. VPS build-out (one-time)

1. Non-root `deploy` user with sudo; SSH key only (`PasswordAuthentication no`, `PermitRootLogin no`); `ufw` allowing 22/80/443 only; `fail2ban`; `unattended-upgrades`; 2 GB swap if RAM ≤ 4 GB; timezone/NTP.
2. Docker Engine + compose plugin. Enable log rotation (`/etc/docker/daemon.json`: `json-file`, `max-size 10m`, `max-file 3`) or the disk fills.
3. `/opt/aegislead/` holding `docker-compose.prod.yml`, `.env.production` (`chmod 600`, owned by `deploy`, **never** in git), `nginx/`, and a named volume for `pgdata`.
4. Postgres 18 container: `POSTGRES_DB=aegislead`, dedicated role, **no published port** (only on the docker network) — or `127.0.0.1:5432` at most. Tune `shared_buffers`/`work_mem` for the box size.
5. Redis container, no published port, `REDIS_URL=redis://redis:6379`.
6. Nginx container (or Caddy if you want automatic certs): `dashboard.aegislead.co` → `/api/*` to `backend:5000`, everything else to `frontend:3000`; HTTP→HTTPS redirect; certbot via webroot or DNS-01.

## 3. DNS / TLS cutover

1. Lower the TTL on `dashboard.aegislead.co` to 300 s **a day before** the cutover (while it still points at Vercel).
2. Add `staging.aegislead.co` → Vercel now, and move the Vercel project's domain to it, so staging keeps a stable URL after the flip.
3. Before flipping: test the VPS stack with a local `/etc/hosts` override (or `curl --resolve dashboard.aegislead.co:443:<VPS_IP>`) so you prove TLS + login + a few API calls work on the real hostname.
4. Flip: delete the Vercel `CNAME`/A record for `dashboard.aegislead.co`, add `A` → VPS IPv4 (+ `AAAA` if you have IPv6). Issue the Let's Encrypt cert **after** the record resolves to the VPS.
5. Keep `aegislead.co` / `www.aegislead.co` (marketing) wherever they are today — unchanged.

## 4. Neon → VPS data migration

**Dry run first (no downtime):**
1. `pg_dump --format=custom --no-owner --no-acl` from the Neon **direct** (non-pooler) URL, using a **PG 18 client**.
2. `pg_restore --no-owner --no-acl` into the VPS DB.
3. Compare `count(*)` per table both sides; run `prisma migrate status`; boot the backend against it and smoke-test login + a few modules.

**Real cutover (maintenance window, ~30–60 min):**
1. Announce downtime. Put the current frontend into maintenance (or stop the Render backend) so nothing writes to Neon mid-dump.
2. Final dump → restore → verify counts + `migrate status` + sequence sanity (`pg_restore` carries sequences, but check one `nextval`).
3. Start the VPS stack with prod env; smoke-test over `--resolve`.
4. Flip DNS; watch logs and `/api/health` for an hour.
5. **Keep Neon untouched for a rollback window** (a week). Rollback = point DNS back at Vercel and restart the Render backend on Neon.
6. After the window: re-point Neon at staging — restore a prod dump into it with PII scrubbed (emails/phones rewritten, Stripe ids cleared), then make it the staging `DATABASE_URL`.

## 5. Backups must move too

`db-backup.yml` currently dumps **Neon** (`BACKUP_DATABASE_URL`) from GitHub Actions. After the migration that's backing up *staging*.

- Production backup should run **on the VPS** (systemd timer or a compose `cron` service): `pg_dump` over the docker network → `gpg --symmetric AES256` → upload to the B2 `daily/` prefix with the same write-only key. That keeps Postgres unexposed; the alternative (opening 5432 to GitHub's runners) is not worth it.
- Keep the GH workflow for Neon/staging, or disable its schedule.
- Add a weekly `pg_restore --list` verification and a quarterly real restore test. Also take GoDaddy VPS snapshots if the plan includes them — they cover the whole box, not just the DB.

## 6. The pipelines (GitHub Actions)

**`ci.yml` — on every PR and push**
- backend: `npm ci` → `npx prisma generate` → `npm run lint` → `npm test` → `npm run build`
- frontend: `npm ci` → `npm run lint` → `npm run build` (with a dummy `NEXT_PUBLIC_API_URL`)
- `npx prisma validate` + `migrate diff` check so a schema edit without a migration fails CI.

**`deploy-staging.yml` — on push to `main`**
- Vercel and Render already auto-deploy from git; the job's real work is `npx prisma migrate deploy` against the **Neon** URL (`STAGING_DATABASE_URL` secret), then poll `/api/health` on the Render URL.

**`deploy-production.yml` — on push to `production` (or tag `v*`)**
- `environment: production` (required reviewer = the manual gate).
- Build + push `ghcr.io/<owner>/aegislead-backend:<sha>` and `-frontend:<sha>` (frontend gets `--build-arg NEXT_PUBLIC_API_URL=/api`).
- SSH to the VPS → write the new image tags → `docker compose pull` → `docker compose run --rm backend npx prisma migrate deploy` (migrations run **inside** the VPS so the DB stays localhost-only) → `docker compose up -d` → poll `https://dashboard.aegislead.co/api/health`.
- On failure: re-pin the previous `:<sha>` tag and `up -d` again. Note that a *schema* rollback is not automatic — keep migrations additive/backward-compatible (expand-then-contract) so the previous image still runs against the new schema.

**Secrets needed** — GitHub: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT`, `STAGING_DATABASE_URL`, (GHCR uses the built-in token). VPS `.env.production`: everything the app reads. Vercel/Render: their own env UIs. Nothing production-only should live in GitHub secrets beyond the SSH key.

## 7. Per-environment config to split (currently shared/implicit)

| Var | Staging | Production (VPS) |
|---|---|---|
| `NODE_ENV` | `production` on Render (keep OTP logging off) | `production` |
| `DATABASE_URL` | Neon | `postgresql://…@postgres:5432/aegislead` |
| `REDIS_URL` | unset or staging Redis | `redis://redis:6379` |
| `FRONTEND_URL` | `https://staging.aegislead.co` | `https://dashboard.aegislead.co` |
| `CORS_ORIGINS` | staging origin | `https://dashboard.aegislead.co` (same-origin makes it moot) |
| `ALLOW_VERCEL_PREVIEW_ORIGINS` | `true` | **unset** |
| `NEXT_PUBLIC_API_URL` | Render backend `/api` | `/api` |
| JWT secrets | staging-only pair | fresh prod pair (32+ chars, different from each other and from staging) |
| `CRM_TOKEN_SECRET` | staging | prod (rotating it breaks stored CRM tokens — set it before go-live) |
| Stripe keys/`STRIPE_WEBHOOK_SECRET` | test | live + new endpoint `https://dashboard.aegislead.co/api/billing/webhook` |
| `*_REDIRECT_URI` (HubSpot/GHL/Salesforce/Pipedrive/Zoho) | staging URLs | prod URLs — **must be re-registered with each vendor** |
| `S3_BUCKET` | staging bucket | prod bucket (separate keys) |
| `EMAIL_FROM` / mail provider | staging sender | verified prod sender |
| `BILLING_RETURN_URL` | staging | prod |

Also update the hard-coded origin list in `backend/src/main.ts` once staging has a stable domain (the `ai-saas-*.vercel.app` wildcard is already off in production — keep it that way).

## 8. After go-live

- Uptime monitor on `https://dashboard.aegislead.co/api/health` (1 min) + TLS expiry alert.
- Error tracking (Sentry) — there is none today; a VPS has no platform dashboard to fall back on.
- Disk alert: Postgres, docker images and logs share one disk.
- Re-register Stripe/CRM webhooks and test one of each end to end.

---

## Suggested order of work

1. Add `/api/health`, Dockerfiles, `output: 'standalone'`, bump compose Postgres to 18, delete `backend/db.js`. (PR to `main`.)
2. Add `ci.yml`. Get it green.
3. Build out the VPS (sections 2), deploy from images manually once, prove it works over `--resolve`.
4. Dry-run the Neon→VPS restore; fix whatever it surfaces.
5. Add `deploy-production.yml` + the `production` environment and branch.
6. Cutover window: final dump/restore + DNS flip (sections 3–4).
7. Move backups to the VPS; repoint Neon at staging with scrubbed data (sections 5, 4.6).
