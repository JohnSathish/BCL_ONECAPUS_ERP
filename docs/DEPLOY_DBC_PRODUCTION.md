# Don Bosco College — Deployment Guide

**Production domain:** `https://erp.donboscocollege.ac.in`  
**Tenant slug:** `demo` (Don Bosco College Tura)

This guide covers two deployment modes:

1. **LAN office server** — your dev PC acts as a server; staff use the ERP on the local network while you fix bugs locally.
2. **Live internet server** — public deployment at `erp.donboscocollege.ac.in`.

---

## Part A — LAN office server (recommended first step)

Use this PC as the college ERP server on your office LAN. You keep coding locally; staff test on the same machine over Wi‑Fi/LAN.

### Requirements

- This PC stays on during office hours
- PostgreSQL + Redis running (`npm run dev:infra` or Docker)
- Windows Firewall allows **TCP 3000** and **3001** (inbound) on Private network

### One-time setup

```powershell
cd E:\Projects\1505NEWERP
npm run db:migrate
npm run db:seed
cd apps\api
npx tsx scripts/production-bootstrap.ts --register-host 192.168.x.x
```

Replace `192.168.x.x` with your PC’s LAN IP (or let `dev:lan` register it automatically).

### Start LAN server

```powershell
npm run dev:lan
```

The script prints something like:

```
LAN URL for staff:  http://192.168.29.170:3000
```

### Tell office staff

1. Connect to the **same office Wi‑Fi / LAN**
2. Open a browser: `http://<LAN-IP>:3000` (e.g. `http://192.168.29.170:3000`)
3. Log in with their demo accounts (same as localhost)

### You (developer) workflow

| Task                                  | Command                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Start LAN server for staff            | `npm run dev:lan`                                                           |
| Code on localhost only                | `npm run dev`                                                               |
| After schema changes                  | `npm run db:migrate`                                                        |
| Register new LAN IP (if DHCP changes) | `npx tsx apps/api/scripts/production-bootstrap.ts --register-host <new-ip>` |

### LAN limitations

- Not HTTPS (fine inside office LAN)
- PC must stay on; dev restarts briefly disconnect staff
- Not suitable as permanent public internet hosting
- Use **Part B** when ready for 24/7 public access

### Troubleshooting LAN

| Problem               | Fix                                             |
| --------------------- | ----------------------------------------------- |
| Staff cannot open URL | Windows Firewall → allow Node/port 3000 inbound |
| Login fails           | Re-run bootstrap with current LAN IP            |
| “Tenant not found”    | Host must exist in `tenant_domains` table       |
| Slow after edits      | Normal — hot reload restarts API briefly        |

---

## Part B — Live server (`erp.donboscocollege.ac.in`)

**Hostinger VPS (Ubuntu 24.04):** see step-by-step guide **[DEPLOY_DBC_VPS_HOSTINGER.md](./DEPLOY_DBC_VPS_HOSTINGER.md)**  
Server: `ssh root@82.25.110.120` · IP `82.25.110.120`

### Pre-flight checklist

- [ ] **10 pending migrations** applied: `npm run db:migrate -w api`
- [ ] **Production secrets** generated (new JWT secrets, not dev defaults)
- [ ] **Demo passwords changed** (`Admin@123` → strong passwords)
- [ ] **DNS** pointed to server (Cloudflare recommended)
- [ ] **HTTPS** via Cloudflare proxy or origin certificate
- [ ] **Managed PostgreSQL** with SSL + daily backups
- [ ] **Redis** for queues and real-time features

### DNS records (Cloudflare)

| Host         | Type      | Points to                       |
| ------------ | --------- | ------------------------------- |
| `erp`        | A / CNAME | App server IP                   |
| `admissions` | A / CNAME | Same server (admissions portal) |
| `library`    | A / CNAME | Same server (library kiosk)     |

Enable **Proxied** (orange cloud) for free HTTPS.

### Production `.env` (app server)

Create a file on the server (never commit):

```bash
DATABASE_URL=postgresql://user:pass@db-host:5432/nep_erp?sslmode=require
REDIS_URL=redis://redis-host:6379

JWT_ACCESS_SECRET=<generate-64-char-random>
JWT_REFRESH_SECRET=<generate-64-char-random>

WEB_ORIGIN=https://erp.donboscocollege.ac.in
CORS_EXTRA_ORIGINS=https://admissions.donboscocollege.ac.in,https://library.donboscocollege.ac.in
COOKIE_SECURE=true
NODE_ENV=production

NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_LOGIN_HOST=erp.donboscocollege.ac.in

STORAGE_DRIVER=local
UPLOAD_ROOT=/data/uploads
STORAGE_ROOT=/data/storage
PROCESS_BACKGROUND_JOBS=api
```

### Bootstrap production domains

After migrate + seed on the server:

```bash
cd apps/api
npx tsx scripts/production-bootstrap.ts \
  --admin-email principal@donboscocollege.ac.in \
  --admin-password '<strong-password>' \
  --admin-name 'Principal'
```

This registers:

- `erp.donboscocollege.ac.in`
- `admissions.donboscocollege.ac.in`
- `library.donboscocollege.ac.in`

### Build and deploy (Docker)

```bash
# On build machine or server
docker build -f apps/api/Dockerfile -t nep-erp-api .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg NEXT_PUBLIC_LOGIN_HOST=erp.donboscocollege.ac.in \
  -t nep-erp-web .
docker build -f apps/worker/Dockerfile -t nep-erp-worker .

# Migrate BEFORE starting API
npm run db:migrate -w api

# Start (external PostgreSQL — omit --profile local-db)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api web worker redis nginx
```

### Health checks

```bash
curl https://erp.donboscocollege.ac.in/api/health/live
curl https://erp.donboscocollege.ac.in/api/health/ready
```

### Portal URLs after go-live

| Portal         | URL                                                |
| -------------- | -------------------------------------------------- |
| Staff ERP      | https://erp.donboscocollege.ac.in                  |
| Admissions     | https://admissions.donboscocollege.ac.in           |
| Library kiosk  | https://library.donboscocollege.ac.in/library-desk |
| Principal desk | https://erp.donboscocollege.ac.in/principal-desk   |

---

## Moving from LAN → Live server

1. **Export database** from LAN PC (Backup Center or `pg_dump`)
2. **Copy uploads** folder (`uploads/`, `storage/`)
3. **Deploy** Docker stack on live server (Part B)
4. **Restore** database + files on live server
5. **Run** `production-bootstrap.ts` with production admin
6. **Point DNS** to live server
7. **Retire** LAN URL for staff; give them `https://erp.donboscocollege.ac.in`

The same codebase and migrations work on both — only environment and DNS change.

---

## Security before public launch

| Item            | Action                                  |
| --------------- | --------------------------------------- |
| Demo passwords  | Change all `Admin@123` accounts         |
| JWT secrets     | Generate new secrets for production     |
| Swagger `/docs` | Restrict by firewall or disable         |
| Backups         | Enable Backup Center + off-site copy    |
| Razorpay        | Configure only when online fees go live |

---

## Quick reference

```bash
# LAN server for office staff
npm run dev:lan

# Local dev (you only)
npm run dev

# Migrations
npm run db:migrate

# Production bootstrap
cd apps/api && npx tsx scripts/production-bootstrap.ts

# Promote super admin
cd apps/api && npx tsx scripts/promote-super-admin.ts user@college.edu
```

See also: [DEPLOYMENT.md](./DEPLOYMENT.md) for generic stack architecture.
