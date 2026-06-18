# Don Bosco College ERP — Hostinger VPS live deploy

**Live URL:** https://erp.donboscocollege.ac.in  
**Server:** Ubuntu 24.04 · `ssh root@82.25.110.120`  
**Hostname:** `srv1125334.hstgr.cloud`  
**Specs:** 2 vCPU · 8 GB RAM · 100 GB disk (plenty for Postgres + app)

---

## Overview

| Layer | How                                                                       |
| ----- | ------------------------------------------------------------------------- |
| DNS   | `erp` / `admissions` / `library` → **82.25.110.120** (Cloudflare proxied) |
| HTTPS | Cloudflare orange cloud (recommended) or Let’s Encrypt on nginx           |
| App   | Docker: `nginx` + `web` + `api` + `worker` + `postgres` + `redis`         |
| Data  | Postgres volume on VPS (`nep_pg_data`)                                    |

---

## Step 1 — DNS (do this first)

In your domain DNS panel (Cloudflare recommended):

| Type | Name         | Value           | Proxy            |
| ---- | ------------ | --------------- | ---------------- |
| A    | `erp`        | `82.25.110.120` | Proxied (orange) |
| A    | `admissions` | `82.25.110.120` | Proxied          |
| A    | `library`    | `82.25.110.120` | Proxied          |

**Cloudflare SSL/TLS:** set mode to **Full** (not Flexible) once origin responds on port 80.

Wait 5–30 minutes for DNS to propagate.

---

## Step 2 — Upload code to the VPS

From your **Windows dev PC** (PowerShell), sync the project:

```powershell
# Install rsync via WSL or use scp; example with scp:
scp -r E:\Projects\1505NEWERP root@82.25.110.120:/opt/nep-erp
```

Or on the VPS with git:

```bash
ssh root@82.25.110.120
mkdir -p /opt/nep-erp
cd /opt/nep-erp
git clone <your-repo-url> .
```

---

## Step 3 — One-time server setup

```bash
ssh root@82.25.110.120
cd /opt/nep-erp
chmod +x scripts/deploy/*.sh
bash scripts/deploy/vps-first-boot.sh
```

This installs Docker, opens firewall (22, 80, 443), and creates `/opt/nep-erp/.env` with random DB + JWT secrets.

**Save a copy of `.env` offline** — you need it for backups and redeploys.

---

## Step 4 — Apply pending migrations locally (optional pre-check)

On your dev PC before go-live, ensure migrations apply cleanly:

```powershell
cd E:\Projects\1505NEWERP
npm run db:migrate
```

**10 migrations** were pending at last check — the VPS deploy script runs `migrate deploy` automatically.

---

## Step 5 — Build and start production stack

On the VPS:

```bash
cd /opt/nep-erp
bash scripts/deploy/vps-deploy.sh
```

First build takes **10–20 minutes**. Subsequent deploys are faster.

---

## Step 6 — Bootstrap domains and admin

```bash
cd /opt/nep-erp
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec api \
  npx tsx scripts/production-bootstrap.ts \
  --admin-email admin@donboscocollege.ac.in \
  --admin-password 'YourStrongPasswordHere' \
  --admin-name 'College Administrator'
```

This registers:

- `erp.donboscocollege.ac.in`
- `admissions.donboscocollege.ac.in`
- `library.donboscocollege.ac.in`

---

## Step 7 — Verify go-live

```bash
# On VPS
curl -s http://127.0.0.1/api/health/live
curl -s http://127.0.0.1/api/health/ready

# From browser (after DNS + Cloudflare)
https://erp.donboscocollege.ac.in/api/health/live
```

Login at https://erp.donboscocollege.ac.in with the admin email/password from Step 6.

---

## Portal URLs

| Portal         | URL                                                |
| -------------- | -------------------------------------------------- |
| Staff ERP      | https://erp.donboscocollege.ac.in                  |
| Admissions     | https://admissions.donboscocollege.ac.in           |
| Library kiosk  | https://library.donboscocollege.ac.in/library-desk |
| Principal desk | https://erp.donboscocollege.ac.in/principal-desk   |

---

## Moving data from LAN dev PC → live server

If staff already used the LAN server with real/demo data:

### 1. Export database (dev PC)

```powershell
docker exec 1505newerp-postgres-1 pg_dump -U nep nep_erp > nep_erp_backup.sql
```

### 2. Copy to VPS

```powershell
scp nep_erp_backup.sql root@82.25.110.120:/opt/nep-erp/
```

### 3. Restore on VPS (after postgres is up), **or** seed from dev PC

**Option A — restore LAN backup** (recommended if you have data):

```bash
cd /opt/nep-erp
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec -T postgres \
  psql -U nep -d nep_erp < nep_erp_backup.sql
```

**Option B — fresh seed from dev PC** (tunnel to VPS postgres on port 15432 if exposed, or run after `scp` + restore empty DB):

```powershell
# On dev PC — after migrations on VPS
cd E:\Projects\1505NEWERP
$env:DATABASE_URL="postgresql://nep:<POSTGRES_PASSWORD>@82.25.110.120:15432/nep_erp"
npm run db:seed
```

Expose postgres port 15432 on VPS only if needed temporarily (firewall restrict to your IP).

### 4. Copy uploads (if any)

```powershell
scp -r E:\Projects\1505NEWERP\apps\api\uploads root@82.25.110.120:/tmp/
# Then on VPS copy into docker volume or mount path
```

---

## Security checklist (before announcing to staff)

- [ ] Change all demo passwords (`Admin@123` → strong passwords)
- [ ] JWT secrets in `.env` are **not** dev defaults (vps-first-boot generates new ones)
- [ ] Production admin uses college email, not `admin@demo.edu`
- [ ] Enable Cloudflare proxy + Full SSL
- [ ] Restrict Hostinger firewall / ufw (only 22, 80, 443)
- [ ] Plan backups (Backup Center in app + `pg_dump` cron)

---

## Redeploy after code changes

```bash
ssh root@82.25.110.120
cd /opt/nep-erp
git pull   # or re-sync from dev PC
bash scripts/deploy/vps-deploy.sh
```

---

## Troubleshooting

| Problem                  | Fix                                                               |
| ------------------------ | ----------------------------------------------------------------- |
| `502` from Cloudflare    | Stack not running — `docker compose ps`, check `api` / `web` logs |
| Login “tenant not found” | Re-run `production-bootstrap.ts`                                  |
| Build fails on web       | Ensure `apps/web/Dockerfile` uses `--include=dev` for tailwind    |
| DB connection error      | Check `.env` `DATABASE_URL` matches `POSTGRES_PASSWORD`           |
| Cloudflare SSL loop      | Set SSL mode to **Full**, origin must answer on port 80           |

### Useful commands

```bash
cd /opt/nep-erp
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db logs -f api
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db logs -f web
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db restart api web nginx
```

---

## Quick reference

```bash
ssh root@82.25.110.120
cd /opt/nep-erp
bash scripts/deploy/vps-first-boot.sh   # once
bash scripts/deploy/vps-deploy.sh       # build + start
```

See also: [DEPLOY_DBC_PRODUCTION.md](./DEPLOY_DBC_PRODUCTION.md) · [DEPLOYMENT.md](./DEPLOYMENT.md)
