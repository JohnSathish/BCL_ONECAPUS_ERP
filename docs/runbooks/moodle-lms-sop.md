# Moodle LMS SOP (ERP + Moodle)

## Scope

- Production operations for ERP-integrated Moodle LMS at:
  - ERP: `https://erp.donboscocollege.ac.in`
  - LMS: `https://lms.donboscocollege.ac.in`
- VPS app path: `/opt/nep-erp`

## Prerequisites

- DNS `lms.donboscocollege.ac.in` points to the ERP VPS IP.
- `.env` contains:
  - `MOODLE_DB_PASSWORD`
  - `MOODLE_ADMIN_PASSWORD`
  - `MOODLE_SSO_SECRET`
  - `MOODLE_TOKEN_ENCRYPTION_KEY`
  - `MOODLE_HOST=lms.donboscocollege.ac.in`
- Moodle image in `docker-compose.yml` uses a valid tag.

## Standard Deploy

```bash
cd /opt/nep-erp
git fetch origin
git checkout master
git pull origin master
bash scripts/deploy/vps-moodle-go-live.sh
```

## ERP-only Deploy

```bash
cd /opt/nep-erp
git fetch origin
git checkout master
git pull origin master
bash scripts/deploy/vps-update-erp-safe.sh
```

## First-Time Moodle Setup (Admin UI)

1. Enable web services:
   - `Site administration -> Advanced features -> Enable web services`
2. Enable REST:
   - `Site administration -> Server -> Web services -> Manage protocols -> REST`
3. Create external service `BCL ERP`.
4. Add functions:
   - `core_webservice_get_site_info`
   - `core_user_create_users`
   - `core_user_update_users`
   - `core_user_get_users_by_field`
   - `core_course_create_courses`
   - `core_course_update_courses`
   - `core_course_get_courses`
   - `enrol_manual_enrol_users`
   - `enrol_manual_unenrol_users`
5. Generate token for ERP service account.
6. In ERP: `Academics -> LMS -> Moodle Settings`:
   - Set URL `https://lms.donboscocollege.ac.in`
   - Paste token
   - Click **Test Connection**

## Daily Ops Checklist

- ERP Moodle **Test Connection** passes.
- Manual sync (if required): Users, Courses.
- Failed jobs count is stable; requeue transient failures.
- Student and faculty **Launch in LMS** works.
- Run smoke test after any deploy.

## Smoke Test

```bash
cd /opt/nep-erp
bash scripts/deploy/vps-smoke-moodle.sh
```

## Health Checks

```bash
cd /opt/nep-erp
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle logs moodle --tail 120
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle logs api --tail 120
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle logs nginx --tail 120
```

## DNS and Routing Verification

```bash
dig +short erp.donboscocollege.ac.in
dig +short lms.donboscocollege.ac.in
curl -kI https://127.0.0.1/ -H "Host: lms.donboscocollege.ac.in"
```

Expected local LMS response includes `Set-Cookie: MoodleSession...` and should not include `x-powered-by: Next.js`.

## Admin Credential Operations

- Username default: `admin` (if `MOODLE_ADMIN_USER` not set)
- Password from `.env`: `MOODLE_ADMIN_PASSWORD`

Check values:

```bash
cd /opt/nep-erp
grep "^MOODLE_ADMIN_USER=" .env
grep "^MOODLE_ADMIN_PASSWORD=" .env
```

Reset admin password:

```bash
cd /opt/nep-erp
MOODLE_CID=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle ps -q moodle)
docker exec -u daemon "$MOODLE_CID" php /bitnami/moodle/admin/cli/reset_password.php --username=admin --password='NewStrongPass@123'
```

## SSO Plugin Verification

```bash
cd /opt/nep-erp
MOODLE_CID=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle ps -q moodle)
docker exec "$MOODLE_CID" test -f /bitnami/moodle/auth/erp/version.php && echo "auth_erp plugin present"
```

## Recovery Playbook

- Pull blocked by local server edits:

```bash
cd /opt/nep-erp
git stash push -u -m "pre-deploy-local-changes"
git pull origin master
```

- Force sync to remote `master` (destructive):

```bash
cd /opt/nep-erp
git fetch origin
git reset --hard origin/master
```

- Missing moodle scripts check:

```bash
cd /opt/nep-erp
ls scripts/deploy | grep moodle
```

Expected:

- `vps-moodle-go-live.sh`
- `vps-provision-moodle.sh`
- `vps-install-moodle-auth-plugin.sh`
- `vps-smoke-moodle.sh`

## Go-Live Acceptance

- ERP reachable with valid SSL.
- LMS reachable with valid SSL.
- ERP Moodle test connection passes.
- User and course sync pass.
- Student and faculty SSO launch pass.
- Smoke test passes with no critical failures.
