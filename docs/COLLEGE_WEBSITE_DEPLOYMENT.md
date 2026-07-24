# Don Bosco College website deployment

The public website is the `@onecampus/college-web` workspace and runs in the
`donboscocollege-web` container. The ERP remains in the `web` service on
`erp.donboscocollege.ac.in`.

## Architecture

```
https://donboscocollege.ac.in
  ├─ /                       → college-web:3000
  ├─ /api/contact|newsletter|blood-donors|fyug-interest|visitors|revalidate
  │                          → college-web:3000  (Next route handlers)
  ├─ /api/*                  → api:3001          (NestJS /api/v1/...)
  └─ /uploads/*              → api:3001
```

Use `nginx/nginx.combined-dbc.ssl.conf` on the VPS (not the ERP-only
`nginx.conf`).

## Required environment

Add to `/opt/nep-erp/.env` (see `scripts/deploy/production.env.example`):

```dotenv
COLLEGE_SITE_URL=https://donboscocollege.ac.in
NEXT_PUBLIC_API_URL=/api
COLLEGE_TENANT_SLUG=demo
COLLEGE_CMS_HOST=donboscocollege.ac.in
NEXT_PUBLIC_ERP_LOGIN_URL=https://erp.donboscocollege.ac.in/login
REVALIDATE_SECRET=<random-32+-chars>
WEBSITE_REVALIDATE_WEBHOOK_URL=http://donboscocollege-web:3000/api/revalidate
CORS_EXTRA_ORIGINS=https://donboscocollege.ac.in,https://www.donboscocollege.ac.in,https://admissions.donboscocollege.ac.in,https://library.donboscocollege.ac.in,https://career.donboscocollege.ac.in,https://pay.donboscocollege.ac.in,https://alumni.donboscocollege.ac.in,https://transient.donboscocollege.ac.in,https://source.donboscocollege.ac.in
COLLEGE_CONTACT_RECIPIENT=info@donboscocollege.ac.in
```

Compose sets `API_INTERNAL_ORIGIN=http://api:3001` for SSR CMS fetches.
Register apex hosts on the CMS tenant (`donboscocollege.ac.in` and
`www.donboscocollege.ac.in`) via seed or:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db \
  exec api npx tsx -e "/* see ensure-college-domain script if present */"
```

## Build and start

```bash
npm ci
npm run db:generate
npm run build -w @onecampus/college-web
cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db \
  build api web college-web
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db \
  up -d api web college-web nginx
```

Apply Prisma migrations before enabling CMS writes:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db \
  run --rm api npm run db:migrate:deploy
```

TLS: ensure Let's Encrypt certs exist for `donboscocollege.ac.in` (and cover
`www`). DNS A/AAAA for apex + www must point at the VPS.

## Smoke tests

```bash
curl -fsSI https://donboscocollege.ac.in/ | head
curl -fsS  https://donboscocollege.ac.in/api/health/live
curl -fsS  https://donboscocollege.ac.in/api/visitors
curl -fsSI https://www.donboscocollege.ac.in/ | head   # expect 301 → apex
curl -fsS  https://donboscocollege.ac.in/mobile-privacy.html | head
curl -fsS  https://erp.donboscocollege.ac.in/
```

Also verify a CMS image under `/uploads/...` and that publishing in Website CMS
revalidates the homepage (webhook hits college-web on the Docker network).

## Rollback

Keep the previous college image tag until smoke tests pass. To roll back only
the public site, restore that image for `donboscocollege-web` and restart
nginx; the API and ERP containers do not need to be reverted.
