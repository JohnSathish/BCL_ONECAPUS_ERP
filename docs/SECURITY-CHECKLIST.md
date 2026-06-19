# Annual Security Checklist — BCL OneCampus ERP

Run before each admission season.

## Vulnerability & dependency scan

- [ ] `npm audit` in repo root (api, web, mobile, worker)
- [ ] OWASP ZAP baseline scan against staging (`erp` + admissions portal)
- [ ] Review Cloudflare WAF events for false positives

## Authentication & access

- [ ] `npx tsx scripts/security/audit-rbac-endpoints.ts` passes
- [ ] MFA enrolled for all users with roles: super-admin, principal, accountant, examination-cell
- [ ] Review super-admin account list; remove unused accounts
- [ ] Permission audit: no orphan `UserPermission` rows with excessive grants

## Backups & recovery

- [ ] Verify `BACKUP_ENCRYPTION_KEY` set on production VPS (not in git)
- [ ] Confirm daily backup cron in worker (`docker-compose.prod.yml`)
- [ ] Restore test: recover latest backup to staging DB
- [ ] Super-admin backup download + audit log entry verified

## Infrastructure

- [ ] SSL cert expiry > 30 days (Let's Encrypt auto-renew)
- [ ] Cloudflare proxy active on all subdomains
- [ ] PostgreSQL port not exposed publicly (Docker network only)
- [ ] Security headers: [securityheaders.com](https://securityheaders.com) grade A or A+

## Application

- [ ] Login lockout: 10 failures → 30 min block
- [ ] Rate limits return HTTP 429 on brute-force simulation
- [ ] Payment webhooks reject unsigned Razorpay payloads
- [ ] CSRF token present on web mutating requests (when cookie session used)
- [ ] Certificate / ID card HTML sanitized (DOMPurify)

## Load testing

- [ ] Login endpoint under admission-day load
- [ ] Fee payment initiation + webhook idempotency
- [ ] Admissions portal application submit

## Sign-off

| Role        | Name | Date |
| ----------- | ---- | ---- |
| Super Admin |      |      |
| Principal   |      |      |
