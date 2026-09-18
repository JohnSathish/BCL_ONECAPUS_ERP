# BaseCode Labs + BaseCode Central

Standalone app for **BaseCode Labs Pvt. Ltd.** — public corporate website and internal license / client hub.

This folder is isolated from the college ERP and St. Luke’s school SIS. Do not import those packs here.

## Run locally

```bash
cd apps/basecode-labs
copy .env.example .env
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Open http://localhost:1610

Admin: http://localhost:1610/admin/login  
Default admin email: `contact@basecodelabs.com` (override with `ADMIN_EMAIL` then re-seed).

Every admin and client login requires a **one-time email code**. If SMTP is not set, the code is printed in the server console and shown on the login form in development.

## Production (St. Luke’s licenses)

1. Host this app on HTTPS (public site + Central), e.g. `https://basecodelabs.com`.
2. Set unique `JWT_SECRET`, `LICENSE_SIGNING_SECRET`, and `BASECODE_LICENSE_API_SECRET`.
3. Configure SMTP so admin OTP is emailed (codes are never returned in production).
4. On the school API VPS set the **same** secret and `BASECODE_CENTRAL_URL=https://basecodelabs.com`, plus `LICENSE_PUBLIC_KEY` / `LICENSE_PRIVATE_KEY`.
5. Issue a **BCL OneCampus ERP** license. Domain may be `st-lukes-tura` or `stlukestura.in`. Paste the `BCL-ONC-…` key on `https://erp.stlukestura.in` with institution code `st-lukes-tura`.

`/api/license/*` machine endpoints require `X-BCL-License-Secret` in production.

## What is included now

- Public site (home, about, products from CMS, services, industries, portfolio, case studies, testimonials with live photographs, blog, contact, legal)
- Visitor unique + page-view counts
- Contact form → CRM lead
- Admin email OTP
- Clients, products, licenses (generate / renew / suspend / activate / deactivate)
- License API: `/api/license/activate|validate|deactivate|heartbeat|status|revoke`
- Client portal shell
- SEO metadata, JSON-LD, sitemap, robots, Google site verification from the live site
- Local-search pages for Tamil Nadu and Meghalaya software queries (on-page SEO + blog). Google ranking cannot be guaranteed.

SQLite is the default database so you can run without Docker. For VPS, point `DATABASE_URL` at the sqlite file in `prisma/data` (the isolated deploy script mounts a Docker volume there).

## VPS (shared with Don Bosco — isolated extra site)

Do **not** add this hostname to the college certificate. On `82.25.110.120`:

```bash
cd /opt/nep-erp
git pull origin master
# DNS A for @ and www must already point here
bash scripts/deploy/vps-configure-basecode-labs.sh
```

Optional mailbox password: `SMTP_PASS='…' bash scripts/deploy/vps-configure-basecode-labs.sh`

## Docker (optional)

```bash
docker compose up --build
```
