# Don Bosco College website deployment

The public website is the `college-web` workspace and runs in the
`donboscocollege-web` container. The ERP remains in the `web` service.

## Required environment

```dotenv
COLLEGE_SITE_URL=https://donboscocollege.ac.in
NEXT_PUBLIC_API_URL=/api
```

The public app uses `API_INTERNAL_ORIGIN=http://api:3001` inside Compose. The
main domain proxies `/api/` and `/uploads/` to NestJS and all other requests to
the college website.

## Build and start

```bash
npm ci
npm run db:generate
npm run build -w college-web
docker compose -f docker-compose.yml -f docker-compose.prod.yml build api web college-web
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api web college-web nginx
```

Apply the generated Prisma migration before enabling CMS writes:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api npm run db:migrate:deploy
```

Activate `nginx/nginx.combined-dbc.ssl.conf` on hosts that still use the
ERP-only nginx configuration, then validate both sites:

```bash
curl -fsS https://donboscocollege.ac.in/
curl -fsS https://donboscocollege.ac.in/api/health/live
curl -fsS https://erp.donboscocollege.ac.in/
```

## Rollback

Keep the previous college image tag until smoke tests pass. To roll back only
the public site, restore that image for `donboscocollege-web` and restart nginx;
the API and ERP containers do not need to be reverted.
