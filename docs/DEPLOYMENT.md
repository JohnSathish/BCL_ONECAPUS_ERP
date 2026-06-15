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

### Recommended split architecture (Don Bosco / 3,000+ students)

| Tier                   | Role                                             | Sizing                                       |
| ---------------------- | ------------------------------------------------ | -------------------------------------------- |
| **App server**         | Nginx, Next.js, NestJS API, Redis, BullMQ worker | 8 CPU, 16 GB RAM, 200 GB SSD                 |
| **Managed PostgreSQL** | Primary database (separate host)                 | Provider default; enable SSL + daily backups |
| **Cloudflare**         | DNS proxy, CDN, DDoS protection                  | Free tier minimum                            |

**DNS (subdomains on one web app):**

- `erp.donboscocollege.ac.in` — staff ERP (`apps/web` default routes)
- `admission.donboscocollege.ac.in` — applicant portal (middleware rewrites to `/admissions-portal`; see `apps/web/middleware.ts`)

**Deploy with external database:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d api web worker redis nginx
# Omit --profile local-db and set DATABASE_URL when using managed PostgreSQL only
```

Persistent volumes (`nep_uploads`, `nep_storage`) store uploads and generated receipt PDFs on the app server until object storage (S3/R2) is configured.

### Production checklist

1. **Managed PostgreSQL** — enable SSL, daily backups, connection pooling (PgBouncer).
2. **Managed Redis** — used for BullMQ, Socket.IO adapter, API response cache, rate-limit store.
3. **Object storage** — S3 or Cloudflare R2 for documents (`STORAGE_DRIVER=s3` or `r2`; see `apps/api/src/shared/storage/`).
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

| Variable                                                  | Purpose                                                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                            | PostgreSQL connection                                                                                    |
| `REDIS_URL`                                               | Redis connection                                                                                         |
| `JWT_ACCESS_SECRET`                                       | Access token signing (≥32 chars)                                                                         |
| `JWT_REFRESH_SECRET`                                      | Refresh token family (≥32 chars)                                                                         |
| `WEB_ORIGIN`                                              | CORS allowlist                                                                                           |
| `UPLOAD_ROOT`                                             | Local upload directory (default: `uploads/`)                                                             |
| `STORAGE_ROOT`                                            | Generated files e.g. receipt PDFs                                                                        |
| `STORAGE_DRIVER`                                          | `local` \| `s3` \| `r2`                                                                                  |
| `AWS_S3_BUCKET`                                           | S3 bucket when using S3                                                                                  |
| `R2_BUCKET`                                               | R2 bucket when using Cloudflare R2                                                                       |
| `PROCESS_BACKGROUND_JOBS`                                 | `api` or `worker` — which process runs BullMQ export jobs                                                |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` | Firebase HTTP v1 push for mobile devices                                                                 |
| `FCM_DEMO_MODE`                                           | Set `true` in dev to log push deliveries without Firebase (replace with real credentials before go-live) |
| `RAZORPAY_WEBHOOK_SECRET`                                 | Verify `POST /api/v1/fees/payments/webhook/razorpay`                                                     |

7. **Scaling** — horizontal scale API + web; worker replicas per queue depth; Socket.IO requires Redis adapter (enabled when `REDIS_URL` is set).

8. **Health checks** — `GET /api/health/live`, `GET /api/health/ready`

9. **API docs** — Swagger at `/docs` (protect in production)

## Mobile app (Phase 1)

- **Admin**: Settings → Administration → **Mobile App Control** (`/admin/administration/mobile-app`)
- **Expo shell**: `apps/mobile` — bootstrap, login, role routing, config-driven dashboard stubs
- **Bootstrap** (public): `GET /api/v1/mobile-app/bootstrap` with `X-Tenant-Slug`
- **Mobile client headers** (required on authenticated calls):

| Header          | Example              | Purpose                                                               |
| --------------- | -------------------- | --------------------------------------------------------------------- |
| `X-Client-Type` | `mobile`             | Returns `refreshToken` in JSON body; enables version/maintenance gate |
| `X-Tenant-Slug` | `demo`               | Tenant resolution before login                                        |
| `X-App-Type`    | `student` \| `staff` | App variant                                                           |
| `X-App-Version` | `1.0.0`              | Force-update gate                                                     |
| `X-Device-Id`   | UUID                 | Stored on refresh session metadata                                    |

**Auth flow**: `GET /v1/auth/challenge` → `POST /v1/auth/login` (mobile headers) → `POST /v1/mobile-app/devices/register` → `GET /v1/mobile-app/config` → home BFF (`/v1/mobile-app/student/home` or `/staff/home`).

**Fee payments (student mobile)**: `POST /v1/fees/me/payments/initiate` → Razorpay SDK → `POST /v1/fees/payments/verify` or poll `GET /v1/fees/me/payments/status/:orderId`; webhook `POST /v1/fees/payments/webhook/razorpay` (public, signature verified).

Run the Expo shell locally:

```bash
cd apps/mobile
npm install
EXPO_PUBLIC_API_URL=http://localhost:3001/api EXPO_PUBLIC_TENANT_SLUG=demo npm start
```

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs install, lint, typecheck, and build on PRs and `main`.

## Multi-tenant resolution

- HTTP header: `X-Tenant-Slug: demo`
- Login body includes `tenantSlug`
- Future: subdomain/custom domain via `tenant_domains`
