# NEP-2020 College ERP — Deployment

## Stack

- **Web**: Next.js (`apps/web`) — port 3000
- **API**: NestJS modular monolith (`apps/api`) — port 3001, prefix `/api`
- **Worker**: BullMQ (`apps/worker`) — Redis queues
- **Data**: PostgreSQL 16, Redis 7
- **Edge**: Nginx reverse proxy (port 80)

## Local development

```bash
# 1. Start infrastructure
docker compose up -d postgres redis

# 2. Configure API env
cp apps/api/.env.example apps/api/.env

# 3. Migrate & seed
npm run db:generate
npm run db:migrate
npm run db:seed

After pulling FYUGP academic lifecycle changes, ensure migration `20250516140000_fyugp_academic_lifecycle` is applied before seeding.

After pulling shift administration changes, apply migration `20250516150000_shift_description` and re-seed for shift-admin demo users.

# 4. Run apps
npm run dev
```

If `EADDRINUSE` on port 3001 (or 3000), a previous dev process is still running. Free the ports and restart:

```bash
npm run dev:clean
```

On Windows you can also run: `Get-NetTCPConnection -LocalPort 3001 | Select OwningProcess` then `Stop-Process -Id <PID> -Force`.

**Demo login**: tenant `demo`, email `admin@demo.edu`, password `Admin@123`

## Production (AWS / Azure / DigitalOcean)

1. **Managed PostgreSQL** — enable SSL, daily backups, connection pooling (PgBouncer).
2. **Managed Redis** — used for BullMQ, Socket.IO adapter, optional rate-limit store.
3. **Object storage** — S3 or Cloudflare R2 for documents (wire in `files` module later).
4. **Containers** — build and push images from CI:

```bash
docker build -f apps/api/Dockerfile -t nep-erp-api .
docker build -f apps/web/Dockerfile -t nep-erp-web .
docker build -f apps/worker/Dockerfile -t nep-erp-worker .
```

5. **Migrations** — run as a one-off job before rolling API:

```bash
npm run db:migrate -w api
```

6. **Secrets** — inject via platform secret manager (never commit `.env`):

| Variable             | Purpose                          |
| -------------------- | -------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection            |
| `REDIS_URL`          | Redis connection                 |
| `JWT_ACCESS_SECRET`  | Access token signing (≥32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token family (≥32 chars) |
| `WEB_ORIGIN`         | CORS allowlist                   |

7. **Scaling** — horizontal scale API + web; worker replicas per queue depth; Socket.IO requires Redis adapter (enabled when `REDIS_URL` is set).

8. **Health checks** — `GET /api/health/live`, `GET /api/health/ready`

9. **API docs** — Swagger at `/docs` (protect in production)

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs install, lint, typecheck, and build on PRs and `main`.

## Multi-tenant resolution

- HTTP header: `X-Tenant-Slug: demo`
- Login body includes `tenantSlug`
- Future: subdomain/custom domain via `tenant_domains`
