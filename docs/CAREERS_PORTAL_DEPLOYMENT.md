# Careers Portal — Production Deployment Checklist

Public URL: **https://career.donboscocollege.ac.in**

This portal is served by the same Next.js app (`apps/web`) as the main ERP. Host-based routing rewrites `career.*` requests to `/careers-portal/*` (see `apps/web/middleware.ts`).

---

## 1. DNS & SSL

- [ ] Create DNS **A** or **CNAME** record: `career.donboscocollege.ac.in` → app server (or Cloudflare proxy)
- [ ] Enable **HTTPS** (Cloudflare SSL or Let’s Encrypt on Nginx)
- [ ] Confirm certificate covers `career.donboscocollege.ac.in`

---

## 2. Tenant domain registration (database)

The API resolves the tenant from `platform.tenant_domains.host`.

```bash
cd apps/api
npx ts-node --transpile-only scripts/ensure-career-portal.ts --tenant=demo
```

Production hosts registered by seed / script:

| Host                           | Purpose    |
| ------------------------------ | ---------- |
| `career.demo.localhost`        | Local dev  |
| `career.donboscocollege.ac.in` | Production |

Verify:

```sql
SELECT host, verified FROM platform.tenant_domains
WHERE host LIKE 'career.%';
```

---

## 3. Environment variables

### Web (`apps/web/.env` or deployment secrets)

| Variable                  | Example                                | Notes                             |
| ------------------------- | -------------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_CAREER_HOST` | `career.donboscocollege.ac.in`         | Used by client career API headers |
| `CAREERS_PUBLIC_URL`      | `https://career.donboscocollege.ac.in` | SEO / sitemap                     |
| `API_INTERNAL_ORIGIN`     | `http://127.0.0.1:3001`                | Server-side proxy to API          |

### API (`apps/api/.env`)

| Variable                         | Notes                                                                     |
| -------------------------------- | ------------------------------------------------------------------------- |
| `WEB_PUBLIC_URL`                 | `https://career.donboscocollege.ac.in` (for admit/verify links if shared) |
| `TURNSTILE_SECRET_KEY`           | Optional; if set, apply form requires Cloudflare Turnstile                |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Web client — must pair with secret                                        |
| `CAREERS_HR_EMAIL`               | `career@donboscocollege.ac.in` — HR inbox for new application alerts      |

---

## 4. Nginx / reverse proxy

Route **career** subdomain to the **same** Next.js upstream as ERP:

```nginx
server {
  listen 443 ssl http2;
  server_name career.donboscocollege.ac.in;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:3001;
  }
}
```

The careers API uses **`X-Login-Host`** (sent by the web client) to resolve the tenant when proxied through Next.js `/api`.

---

## 5. Branding & content (Admin)

**Admin → Administration → Theme & Branding** (or **Settings → Branding**)

Open the **Branding** tab, scroll to **Careers portal — public website**:

1. **Hero banner slider** — upload up to 5 campus photos (Slide 1 = first image shown). JPG/PNG, landscape ~1600×900 px recommended. Uploads apply immediately; refresh the careers site to see them.
2. **Logo** — use **Institution assets** section above (same page) for the header logo.
3. **Principal** — photo + welcome message; click **Save changes** after editing text.

Run DBC defaults:

```bash
npx ts-node --transpile-only scripts/apply-dbc-branding.ts --tenant=demo
```

---

## 6. HR recruitment workflow

- [ ] Create designations & departments (if not already)
- [ ] **HR → Recruitment → Vacancies** → create vacancy
- [ ] Set closing date, job description, eligibility
- [ ] **Publish** vacancy (status `PUBLISHED` + slug generated)
- [ ] Confirm vacancy appears on careers home table and `/jobs`

---

## 7. Post-deploy smoke test

```bash
cd apps/api
npx ts-node --transpile-only scripts/verify-careers-portal-e2e.ts
```

Manual checklist:

- [ ] `https://career.donboscocollege.ac.in/` loads landing page
- [ ] Openings table shows published vacancies
- [ ] Job detail → 7-step apply wizard → submit (no `vacancyId` error)
- [ ] Document uploads (resume, photo) succeed
- [ ] Track application with application number + mobile
- [ ] Application visible in **HR → Recruitment → ATS**

---

## 8. Optional hardening

- [ ] Cloudflare Turnstile on apply form (production bots)
- [ ] Rate limits already on `/apply` (8 per 15 min per IP)
- [ ] Email `career@donboscocollege.ac.in` configured for notifications
- [ ] WhatsApp support number in portal info (if using)

---

## 9. Rollback

- Unpublish vacancies (status → `DRAFT`) to stop new applications
- Remove or disable `career.donboscocollege.ac.in` DNS if needed
- ERP core remains unaffected — careers module is isolated under `/careers-portal`

---

## 10. Live server deploy commands

From the repo root on the **production server** (after `git pull`):

```bash
# 1. Install dependencies
npm ci

# 2. Database (includes careers portal migration)
npm run db:migrate -w api

# 3. Register career subdomain + branding defaults
cd apps/api
npx ts-node --transpile-only scripts/ensure-career-portal.ts --tenant=demo
npx ts-node --transpile-only scripts/apply-dbc-branding.ts --tenant=demo

# 4. Seed communication templates (required for apply/status emails)
#    In ERP: Admin → Communication → Templates → Seed defaults
#    Or call POST /v1/communication/templates/seed (admin auth)

# 5. Build
cd ../..
npm run build -w api
npm run build -w web
npm run build -w worker

# 6. Smoke test (API must be running)
cd apps/api
CAREER_HOST=career.donboscocollege.ac.in \
  API_INTERNAL_URL=http://127.0.0.1:3001/api \
  npx ts-node --transpile-only scripts/verify-careers-portal-e2e.ts
```

**Docker (recommended for production):**

```bash
git pull origin main
npm run db:migrate -w api
cd apps/api && npx ts-node --transpile-only scripts/ensure-career-portal.ts --tenant=demo && cd ../..

docker build -f apps/api/Dockerfile -t nep-erp-api .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=/api \
  --build-arg NEXT_PUBLIC_LOGIN_HOST=erp.donboscocollege.ac.in \
  --build-arg NEXT_PUBLIC_CAREER_HOST=career.donboscocollege.ac.in \
  -t nep-erp-web .
docker build -f apps/worker/Dockerfile -t nep-erp-worker .

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api web worker redis nginx
```

Restart services after deploy: `docker compose ... restart web api worker`

---

## Related docs

- [DEPLOYMENT.md](./DEPLOYMENT.md) — full stack deployment
- [DEPLOY_DBC_PRODUCTION.md](./DEPLOY_DBC_PRODUCTION.md) — Don Bosco production steps
