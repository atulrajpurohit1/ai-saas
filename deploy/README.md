# Production VPS runbook

Everything in this directory is for the GoDaddy VPS that serves
`dashboard.aegislead.co`. Staging stays on Vercel (frontend), Render (backend)
and Neon (database) and is not affected by anything here.

| File | What it is |
|---|---|
| `docker-compose.prod.yml` | the production stack: Postgres 18, Redis, backend, frontend, Nginx |
| `.env.production.example` | template for `/opt/aegislead/.env.production` (the real one is never committed) |
| `nginx/conf.d/` | the reverse-proxy config — `/api/*` to the backend, everything else to Next.js |
| `remote-deploy.sh` | what a deploy actually runs on the box; called over SSH by the deploy workflow |
| `backup-db.sh` | nightly encrypted `pg_dump` to Backblaze B2, replacing the GitHub-hosted backup for production |

## 1. Prepare the box

As root, once:

```bash
adduser --disabled-password --gecos '' deploy
usermod -aG docker deploy            # after Docker is installed
mkdir -p /opt/aegislead && chown deploy:deploy /opt/aegislead

# SSH: keys only
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh

ufw default deny incoming && ufw default allow outgoing
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
apt-get install -y fail2ban unattended-upgrades
```

Docker Engine + the compose plugin, from Docker's own apt repository (the
distro package is usually too old). Then cap the logs, or they will fill the
disk:

```json
// /etc/docker/daemon.json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
```

If the box has 4 GB of RAM or less, add swap — a Postgres restore and an image
pull at the same time will otherwise get something OOM-killed:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Install the stack

As `deploy`:

```bash
cd /opt/aegislead
# copy from this repo: docker-compose.prod.yml, nginx/, remote-deploy.sh, backup-db.sh
cp .env.production.example .env.production
chmod 600 .env.production
$EDITOR .env.production        # fill in every blank; see the comments in it
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres redis
```

## 3. Certificate, in this order

`10-dashboard-tls.conf.disabled` is disabled on purpose: Nginx refuses to start
when `ssl_certificate` points at a file that does not exist, so the TLS config
cannot be in place before the certificate is.

1. Point `dashboard.aegislead.co` at the VPS first — Let's Encrypt validates
   over the public DNS name, so the record has to be live. (Lower its TTL to
   300s a day beforehand, while it still points at Vercel.)
2. Start Nginx with HTTP only: `docker compose ... up -d nginx`
3. Issue:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production \
     --profile certs run --rm certbot certonly --webroot -w /var/www/certbot \
     -d dashboard.aegislead.co --email you@aegislead.co --agree-tos --no-eff-email
   ```
4. Enable TLS: `mv nginx/conf.d/10-dashboard-tls.conf.disabled nginx/conf.d/10-dashboard-tls.conf`
   then `docker compose ... up -d --force-recreate nginx`
5. Renewal, as a root cron entry (certbot only acts when a cert is within 30
   days of expiry, so running it daily is correct):
   ```
   17 3 * * * cd /opt/aegislead && docker compose -f docker-compose.prod.yml --env-file .env.production --profile certs run --rm certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f docker-compose.prod.yml --env-file .env.production exec nginx nginx -s reload
   ```

To rehearse the whole stack *before* moving DNS, point your own machine at the
VPS instead of changing the record for everyone:

```bash
curl --resolve dashboard.aegislead.co:443:<VPS_IP> https://dashboard.aegislead.co/api/health/ready
```

(That needs the certificate, which needs public DNS — so the usual order is:
move DNS, issue the cert, verify, and keep the Render/Vercel deployment warm as
the rollback until you are satisfied.)

## 4. First deploy

Images come from GHCR, built by `.github/workflows/deploy-production.yml`.
Log the box in once, by hand, with a personal access token that has
`read:packages` (later deploys reuse the workflow's own token):

```bash
echo <PAT> | docker login ghcr.io -u <github-user> --password-stdin
chmod +x remote-deploy.sh
./remote-deploy.sh ghcr.io/<owner>/aegislead-backend:<sha> ghcr.io/<owner>/aegislead-frontend:<sha>
```

After that, a push to the `production` branch does it, gated by the
`production` environment's required reviewer.

**Rollback:** put the previous tags back in `.env.production` and
`docker compose ... up -d`. Migrations are not reverted — keep them
backward-compatible (add, don't drop or rename, in the same release) so the
previous image still runs against the new schema.

## 5. Data migration from Neon

See `docs/CICD_VPS_MIGRATION_PLAN.md` section 4. The short version:

```bash
# On a machine with the Postgres 18 client and the Neon DIRECT (non-pooler) URL:
pg_dump "$NEON_URL" --format=custom --no-owner --no-acl --file=neon.dump
pg_restore --list neon.dump > /dev/null      # refuse a broken dump

# On the VPS:
docker compose ... cp neon.dump postgres:/tmp/neon.dump
docker compose ... exec -T postgres pg_restore --no-owner --no-acl \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" /tmp/neon.dump
docker compose ... run --rm --no-deps backend npx prisma migrate status   # must be up to date
```

Dump and restore with a **Postgres 18** client: Neon runs 18 and an 18 dump
cannot be restored into an older server.

## 6. Backups

```bash
sudo cp backup-db.sh /opt/aegislead/backup-db.sh
sudo chmod 750 /opt/aegislead/backup-db.sh
sudo crontab -e
# 30 20 * * * /opt/aegislead/backup-db.sh >> /var/log/aegislead-backup.log 2>&1
```

20:30 UTC is 02:00 IST, the same slot the GitHub workflow used. Keep
`BACKUP_PASSPHRASE` somewhere that is not this server, and restore a dump for
real once a quarter — an untested backup is a guess.

`.github/workflows/db-backup.yml` keeps backing up **Neon**, which after the
migration means staging. Leave it for that, or disable its schedule.

## 7. After go-live

- Uptime monitor on `https://dashboard.aegislead.co/api/health` (liveness) and
  a separate check on `/api/health/ready` (database).
- Re-register the Stripe live webhook at
  `https://dashboard.aegislead.co/api/billing/webhook` and every CRM
  connector's redirect URI against the new host.
- Watch disk: Postgres data, images and logs share one volume.
