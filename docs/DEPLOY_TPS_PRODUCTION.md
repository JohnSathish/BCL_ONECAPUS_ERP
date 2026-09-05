# Tura Public School — production deploy (Hostinger VPS)

**Goal:** Run TPS admission + school ERP on dedicated domains without disturbing Don Bosco College, Mercy Dosa House, or Diocese sites already on the same VPS.

| Item                 | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| Server               | `82.25.110.120` (`ssh root@82.25.110.120`)                             |
| App path             | `/opt/nep-erp` (shared monorepo / Docker stack; tenant-isolated)       |
| Applicant portal     | https://admission.turapublicschool.com/                                |
| School ERP admin     | https://erp.turapublicschool.com/                                      |
| Git (TPS production) | https://github.com/JohnSathish/tps2026.git                             |
| School mailbox       | `info@turapublicschool.com` via `SCHOOL_SMTP_*` (not college `SMTP_*`) |

## Architecture (isolated at the reverse proxy)

```
Internet
  ├── admission.turapublicschool.com  → nginx extra-sites vhost → web + api (Host header)
  └── erp.turapublicschool.com        → nginx extra-sites vhost → web + api (Host header)

Existing (unchanged server blocks):
  donboscocollege.ac.in / erp.donboscocollege.ac.in / admissions.* / Mercy / Diocese
```

- TPS uses a **separate Let's Encrypt certificate** (`admission.turapublicschool.com` SANs include both TPS hosts).
- TPS nginx lives only in `nginx/extra-sites.d/tps-turapublicschool.conf` (Mercy restore writes `hosted-sites.conf` and must not overwrite TPS).
- Data isolation is by **tenant** `tura-public-school` in the shared Postgres (same pattern as other portals). School uploads under `/uploads/.../school-admissions/` are blocked from anonymous static serve.

## DNS

Already expected:

- `admission.turapublicschool.com` → `82.25.110.120`
- `erp.turapublicschool.com` → `82.25.110.120`

Do not change apex `turapublicschool.com` (marketing site elsewhere).

## One-time VPS steps

1. **SSH access** — authorize your workstation public key on the VPS (`~/.ssh/authorized_keys`).
2. **Pull code** that includes school admissions + `scripts/deploy/vps-configure-tps.sh`.
3. **Set secrets** in `/opt/nep-erp/.env` (never commit):

```bash
SCHOOL_SMTP_HOST=smtp.hostinger.com
SCHOOL_SMTP_PORT=465
SCHOOL_SMTP_SECURE=true
SCHOOL_SMTP_USER=info@turapublicschool.com
SCHOOL_SMTP_PASS='…Hostinger mailbox password…'
SCHOOL_SMTP_FROM=info@turapublicschool.com
SCHOOL_SMTP_FROM_NAME=Tura Public School
SCHOOL_ADMISSIONS_LOGIN_URL=https://admission.turapublicschool.com/school-admissions-portal/login
# Ensure CORS includes both TPS origins (script also patches this):
# CORS_EXTRA_ORIGINS=…,https://admission.turapublicschool.com,https://erp.turapublicschool.com
COOKIE_SECURE=true
```

4. **Configure SSL + vhosts + seed + deploy:**

```bash
ssh root@82.25.110.120
cd /opt/nep-erp
bash scripts/deploy/vps-configure-tps.sh
```

From Windows (after SSH works):

```powershell
.\scripts\deploy\fast-deploy-tps.ps1 -SkipPush
```

## What the script does / does not do

**Does:**

- Backup nginx, extra-sites, `.env`, and Postgres dump under `/opt/backups/tps-pre-deploy/<stamp>/`
- Issue/renew **only** the TPS certificate
- Add TPS vhosts via `extra-sites.d` (does not rewrite DBC `server_name` lists)
- Patch CORS + SCHOOL\_\* defaults additively
- Run `vps-update-erp-safe.sh` (preserves college website)
- Run `ensure-tps-school.ts` (tenant domains including both production hosts)
- Smoke-test DBC + TPS afterward

**Does not:**

- Replace `nginx.combined-dbc.ssl.conf` wholesale with a generic config
- Expand the Don Bosco LE certificate with TPS names
- Drop or recreate Postgres
- Change Mercy/Diocese ports or certs
- Commit secrets

## Rollback

Printed at the end of `vps-configure-tps.sh`. Essentially restore backed-up `nginx.conf`, `extra-sites.d`, `.env`, reload nginx/api; restore DB dump only if a migration corrupted data.

## Post-deploy checklist

- [ ] https://admission.turapublicschool.com/ loads school portal (not Campus ERP placeholder)
- [ ] Valid TLS (no name mismatch) on both TPS hosts; HTTP → HTTPS
- [ ] `/api/v1/auth/context` with `X-Login-Host` returns `tura-public-school`
- [ ] Registration OTP from `info@turapublicschool.com`
- [ ] Admin login on https://erp.turapublicschool.com/login
- [ ] Admission open/close + last date from admin without redeploy
- [ ] PDF package + document downloads (authenticated only)
- [ ] https://donboscocollege.ac.in/ and https://erp.donboscocollege.ac.in/login still OK

## Security notes

- Applicant documents: authenticated download endpoints; static `/uploads/.../school-admissions/` returns 401.
- Cookies: `COOKIE_SECURE=true`, host-scoped refresh cookie, `SameSite=lax`.
- Do not enable `NEXT_PUBLIC_SHOW_DEMO_LOGIN` on production.
- Change default seed admin password immediately after first login.
