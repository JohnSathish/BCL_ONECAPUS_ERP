# Alumni Portal — Phase 1

Public portal URL (production): **https://alumni.donboscocollege.ac.in**

Same Next.js app as ERP. Host rewrite: `alumni.*` → `/alumni-portal/*` ([`apps/web/middleware.ts`](../apps/web/middleware.ts)).

## What shipped (Phase 1)

- Expanded alumni schema (profiles, membership types, memberships, payments, events, donations, committee, settings)
- Public API: `GET/POST /v1/alumni/portal/*`
- Admin API: dashboard, list, activate, convert-student
- Public portal UI (navy/gold): Home, About, Events, Members directory, Gallery, Contact, Register
- Admin Alumni workspace with KPIs + activate membership

## Local setup

```bash
# API — restart after migrate so Prisma client regenerates
cd apps/api
npx prisma migrate deploy
npx prisma generate
npx tsx scripts/ensure-alumni-portal.ts --tenant=demo

# Preview
# http://localhost:3000/alumni-portal
# or map alumni.demo.localhost → 127.0.0.1 and open http://alumni.demo.localhost:3000
```

## Next phases (not in this commit)

- Razorpay membership payment + receipts/certificates/ID cards
- Full event registration, QR attendance, gallery uploads
- Donations campaigns, job board, success stories, push/SMS
- Alumni member login dashboard
- Rich CMS for About / Committee content
