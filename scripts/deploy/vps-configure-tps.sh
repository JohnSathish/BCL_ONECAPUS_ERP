#!/usr/bin/env bash
# Configure Tura Public School admission + ERP hosts on the shared DBC VPS
# WITHOUT replacing Don Bosco / Mercy / Diocese nginx or certificates.
#
# Domains:
#   https://admission.turapublicschool.com  → applicant portal
#   https://erp.turapublicschool.com        → school admin ERP
#
# Prerequisites (run on VPS as root):
#   - DNS A records already point at this server
#   - /opt/nep-erp is the live monorepo (same stack as DBC)
#   - SCHOOL_SMTP_* set in /opt/nep-erp/.env (password never committed)
#
# Usage:
#   cd /opt/nep-erp && bash scripts/deploy/vps-configure-tps.sh
#   SKIP_CODE_DEPLOY=1 bash scripts/deploy/vps-configure-tps.sh   # nginx/SSL/env only
#   SKIP_SSL=1 bash scripts/deploy/vps-configure-tps.sh           # skip certbot
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
EMAIL="${SSL_EMAIL:-info@turapublicschool.com}"
CERT_NAME="${TPS_CERT_NAME:-admission.turapublicschool.com}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/tps-pre-deploy}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

ADM_HOST="admission.turapublicschool.com"
ERP_HOST="erp.turapublicschool.com"
TPS_ORIGINS="https://${ADM_HOST},https://${ERP_HOST}"

cd "$APP_DIR"

echo "=== Tura Public School — isolated production configure ==="
echo "Time: $(date -Is)"
echo "Commit: $(git log -1 --oneline 2>/dev/null || echo '(no git)')"
echo "Backup: ${BACKUP_ROOT}"

# ── 0. Preflight: record existing apps (must still work after) ──
echo
echo "--- Existing application smoke (before) ---"
declare -A BEFORE=()
probe() {
  local name="$1" url="$2"
  local code
  code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 "$url" || echo 000)"
  BEFORE["$name"]="$code"
  echo "  ${name}: HTTP ${code}  (${url})"
}
probe college "https://donboscocollege.ac.in/"
probe dbc_erp "https://erp.donboscocollege.ac.in/login"
probe dbc_adm "https://admissions.donboscocollege.ac.in/"
probe mercy "https://mercydosahouse.com/" || true
probe diocese "https://turadiocese.in/" || true
probe tps_adm "https://${ADM_HOST}/"
probe tps_erp "https://${ERP_HOST}/login"

# ── 1. Backups (nginx + env + optional DB dump) ──
STAMP="$(date +%Y%m%d%H%M%S)"
mkdir -p "${BACKUP_ROOT}/${STAMP}"
cp -a nginx/nginx.conf "${BACKUP_ROOT}/${STAMP}/nginx.conf.bak" 2>/dev/null || true
cp -a nginx/extra-sites.d "${BACKUP_ROOT}/${STAMP}/extra-sites.d" 2>/dev/null || true
if [[ -f .env ]]; then
  # Redact nothing in filesystem backup on server; never copy off-box into git.
  cp -a .env "${BACKUP_ROOT}/${STAMP}/env.bak"
fi
echo "Backup written under ${BACKUP_ROOT}/${STAMP}"

if [[ "${SKIP_DB_BACKUP:-0}" != "1" ]]; then
  echo "Taking Postgres dump (tenant-safe; full DB backup for rollback)…"
  mkdir -p "${BACKUP_ROOT}/${STAMP}/db"
  if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx postgres; then
    "${COMPOSE[@]}" exec -T postgres \
      pg_dump -U "${POSTGRES_USER:-nep}" "${POSTGRES_DB:-nep_erp}" \
      | gzip > "${BACKUP_ROOT}/${STAMP}/db/nep_erp.sql.gz" || \
      echo "WARN: pg_dump failed — continue only if you already have a recent backup"
  else
    echo "WARN: postgres container not running — skipped DB dump"
  fi
fi

# ── 2. Ensure combined nginx + ACME path ──
if [[ ! -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  echo "ERROR: missing nginx/nginx.combined-dbc.ssl.conf" >&2
  exit 1
fi
if ! grep -q 'extra-sites.d' nginx/nginx.combined-dbc.ssl.conf; then
  echo "ERROR: combined nginx has no extra-sites include" >&2
  exit 1
fi

mkdir -p nginx/extra-sites.d certbot/www/.well-known/acme-challenge /etc/letsencrypt
cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq certbot
fi

# ── 3. Let's Encrypt for TPS hosts only (separate cert name) ──
cert_ok() {
  local cert="/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem"
  [[ -f "$cert" ]] || return 1
  openssl x509 -in "$cert" -noout -checkend 2592000 >/dev/null 2>&1 || return 1
  openssl x509 -in "$cert" -noout -text 2>/dev/null | grep -q "DNS:${ADM_HOST}" || return 1
  openssl x509 -in "$cert" -noout -text 2>/dev/null | grep -q "DNS:${ERP_HOST}" || return 1
}

if [[ "${SKIP_SSL:-0}" != "1" ]]; then
  if cert_ok; then
    echo "KEEP TPS certificate ${CERT_NAME} (valid + both SANs)"
  else
    echo "Issuing/expanding Let's Encrypt cert: ${CERT_NAME}"
    "${COMPOSE[@]}" up -d nginx
    sleep 3
    PROBE="tps-acme-${STAMP}"
    echo "ok-${PROBE}" > "certbot/www/.well-known/acme-challenge/${PROBE}"
    for h in "$ADM_HOST" "$ERP_HOST"; do
      body="$(curl -4 -sS --max-time 15 "http://${h}/.well-known/acme-challenge/${PROBE}" || true)"
      if [[ "$body" != "ok-${PROBE}" ]]; then
        echo "ERROR: ACME HTTP-01 probe failed for ${h} (got: ${body:0:80})" >&2
        echo "Fix DNS or port 80, then re-run. Existing apps were not modified beyond nginx reload attempt." >&2
        rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"
        exit 1
      fi
      echo "OK ACME probe ${h}"
    done
    rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"

    certbot certonly \
      --webroot -w "${APP_DIR}/certbot/www" \
      --cert-name "$CERT_NAME" \
      -d "$ADM_HOST" -d "$ERP_HOST" \
      --email "$EMAIL" \
      --agree-tos \
      --no-eff-email \
      --non-interactive \
      --expand \
      --preferred-challenges http

    if ! cert_ok; then
      echo "ERROR: certificate missing required SANs after certbot" >&2
      exit 1
    fi
  fi
else
  echo "SKIP_SSL=1 — not calling certbot"
  if [[ ! -f "/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem" ]]; then
    echo "ERROR: no certificate at /etc/letsencrypt/live/${CERT_NAME}" >&2
    exit 1
  fi
fi

# ── 4. Write TPS-only extra-site vhost (does not touch hosted-sites.conf) ──
TEMPLATE="${APP_DIR}/scripts/deploy/templates/tps-nginx.conf.template"
TARGET="${APP_DIR}/nginx/extra-sites.d/tps-turapublicschool.conf"
if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: missing ${TEMPLATE}" >&2
  exit 1
fi
cp "$TEMPLATE" "$TARGET"
echo "Wrote ${TARGET}"

"${COMPOSE[@]}" exec -T nginx nginx -t
"${COMPOSE[@]}" up -d nginx
"${COMPOSE[@]}" exec -T nginx nginx -s reload || true
sleep 2

# ── 5. Patch .env (additive; never wipe existing secrets) ──
if [[ -f .env ]]; then
  python3 - <<'PY'
from pathlib import Path
env_path = Path(".env")
text = env_path.read_text(encoding="utf-8")
lines = text.splitlines()
keys = {}
order = []
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        order.append(("raw", line))
        continue
    k, _, v = line.partition("=")
    keys[k] = v
    order.append(("kv", k))

def set_default(k, v):
    if k not in keys or not str(keys.get(k, "")).strip():
        keys[k] = v

# Always enforce production portal URL for school mail links
keys["SCHOOL_ADMISSIONS_LOGIN_URL"] = (
    "https://admission.turapublicschool.com/school-admissions-portal/login"
)
set_default("SCHOOL_SMTP_HOST", "smtp.hostinger.com")
set_default("SCHOOL_SMTP_PORT", "465")
set_default("SCHOOL_SMTP_SECURE", "true")
set_default("SCHOOL_SMTP_USER", "info@turapublicschool.com")
set_default("SCHOOL_SMTP_FROM", "info@turapublicschool.com")
set_default("SCHOOL_SMTP_FROM_NAME", "Tura Public School")
# Do not invent SCHOOL_SMTP_PASS — leave empty / existing

cors = keys.get("CORS_EXTRA_ORIGINS", "")
parts = [p.strip() for p in cors.split(",") if p.strip()]
for origin in (
    "https://admission.turapublicschool.com",
    "https://erp.turapublicschool.com",
):
    if origin not in parts:
        parts.append(origin)
keys["CORS_EXTRA_ORIGINS"] = ",".join(parts)
keys["COOKIE_SECURE"] = "true"

seen = set()
out = []
for kind, val in order:
    if kind == "raw":
        out.append(val)
        continue
    k = val
    if k in seen:
        continue
    seen.add(k)
    out.append(f"{k}={keys[k]}")
for k, v in keys.items():
    if k not in seen:
        out.append(f"{k}={v}")
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("Patched .env CORS + SCHOOL_* defaults (passwords preserved)")
PY
  if ! grep -q '^SCHOOL_SMTP_PASS=.\+' .env; then
    echo
    echo "WARN: SCHOOL_SMTP_PASS is empty in .env — OTP/email will fail until you set it."
    echo "  Edit /opt/nep-erp/.env then: docker compose ... up -d api"
  fi
else
  echo "WARN: no .env — create from scripts/deploy/production.env.example first"
fi

# ── 6. Optional code deploy (safe ERP update) ──
if [[ "${SKIP_CODE_DEPLOY:-0}" != "1" ]]; then
  echo
  echo "Deploying application code via vps-update-erp-safe.sh…"
  bash scripts/deploy/vps-update-erp-safe.sh
else
  echo "SKIP_CODE_DEPLOY=1 — recreating api so new SCHOOL_* env is loaded"
  "${COMPOSE[@]}" up -d api
fi

# ── 7. Ensure TPS tenant + domains ──
echo
echo "Ensuring Tura Public School tenant / domains / KG 2027 cycle…"
"${COMPOSE[@]}" exec -T api npx tsx scripts/ensure-tps-school.ts || \
  "${COMPOSE[@]}" exec -T api node -e "console.error('ensure-tps-school failed')" 

# ── 8. Post checks ──
echo
echo "--- TPS SSL / app checks ---"
for url in \
  "https://${ADM_HOST}/" \
  "https://${ERP_HOST}/login" \
  "https://${ADM_HOST}/api/health/live" \
  "https://${ERP_HOST}/api/v1/auth/context"
do
  code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)"
  echo "  ${code}  ${url}"
done

CTX="$(curl -sk --max-time 20 -H "X-Login-Host: ${ADM_HOST}" \
  "https://${ADM_HOST}/api/v1/auth/context" || true)"
echo "  admission login-context: ${CTX:0:180}"

CTX2="$(curl -sk --max-time 20 -H "X-Login-Host: ${ERP_HOST}" \
  "https://${ERP_HOST}/api/v1/auth/context" || true)"
echo "  erp login-context: ${CTX2:0:180}"

echo
echo "--- Existing application smoke (after) ---"
fail=0
for name in college dbc_erp dbc_adm; do
  case "$name" in
    college) url="https://donboscocollege.ac.in/" ;;
    dbc_erp) url="https://erp.donboscocollege.ac.in/login" ;;
    dbc_adm) url="https://admissions.donboscocollege.ac.in/" ;;
  esac
  code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 "$url" || echo 000)"
  before="${BEFORE[$name]:-?}"
  echo "  ${name}: before=${before} after=${code}"
  if [[ "$code" != "200" && "$code" != "301" && "$code" != "302" && "$code" != "303" && "$code" != "307" && "$code" != "308" ]]; then
    if [[ "$before" == "200" || "$before" == "301" || "$before" == "302" ]]; then
      echo "  ERROR: ${name} regressed" >&2
      fail=1
    fi
  fi
done

echo
echo "Rollback (if needed):"
echo "  cp ${BACKUP_ROOT}/${STAMP}/nginx.conf.bak ${APP_DIR}/nginx/nginx.conf"
echo "  cp -a ${BACKUP_ROOT}/${STAMP}/extra-sites.d/. ${APP_DIR}/nginx/extra-sites.d/"
echo "  cp ${BACKUP_ROOT}/${STAMP}/env.bak ${APP_DIR}/.env"
echo "  cd ${APP_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d nginx api"
echo "  # DB: gunzip -c ${BACKUP_ROOT}/${STAMP}/db/nep_erp.sql.gz | docker compose ... exec -T postgres psql -U nep nep_erp"

if [[ "$fail" -ne 0 ]]; then
  echo "FAILED existing-app checks — investigate before declaring success" >&2
  exit 1
fi

echo
echo "Done. Applicant: https://${ADM_HOST}/"
echo "      Admin:     https://${ERP_HOST}/login"
echo "Cert renewals: certbot renew (existing timer) covers ${CERT_NAME}"
