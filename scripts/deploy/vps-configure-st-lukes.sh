#!/usr/bin/env bash
# Configure St. Luke's Secondary School public site + ERP on the shared DBC VPS
# WITHOUT replacing Don Bosco / Mercy / Diocese / TPS nginx or certificates.
#
# Domains:
#   https://stlukestura.in           → public school website
#   https://www.stlukestura.in       → 301 to apex
#   https://erp.stlukestura.in       → school office ERP
#
# Do NOT create admission.stlukestura.in (TPS KG admissions prefix).
#
# Prerequisites (run on VPS as root):
#   - DNS A records for @, www, and erp already point at this server (82.25.110.120)
#   - /opt/nep-erp is the live monorepo
#
# Usage:
#   cd /opt/nep-erp && git pull && bash scripts/deploy/vps-configure-st-lukes.sh
#   SKIP_CODE_DEPLOY=1 bash scripts/deploy/vps-configure-st-lukes.sh
#   SKIP_SSL=1 bash scripts/deploy/vps-configure-st-lukes.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
EMAIL="${SSL_EMAIL:-admin@stlukestura.in}"
CERT_NAME="${SLS_CERT_NAME:-stlukestura.in}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/st-lukes-pre-deploy}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

SITE_HOST="stlukestura.in"
WWW_HOST="www.stlukestura.in"
ERP_HOST="erp.stlukestura.in"

cd "$APP_DIR"

echo "=== St. Luke's Secondary School — isolated production configure ==="
echo "Time: $(date -Is)"
echo "Commit: $(git log -1 --oneline 2>/dev/null || echo '(no git)')"
echo "Backup: ${BACKUP_ROOT}"

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
probe tps_adm "https://admission.turapublicschool.com/" || true
probe sls_site "https://${SITE_HOST}/"
probe sls_erp "https://${ERP_HOST}/login"

STAMP="$(date +%Y%m%d%H%M%S)"
mkdir -p "${BACKUP_ROOT}/${STAMP}"
cp -a nginx/nginx.conf "${BACKUP_ROOT}/${STAMP}/nginx.conf.bak" 2>/dev/null || true
cp -a nginx/extra-sites.d "${BACKUP_ROOT}/${STAMP}/extra-sites.d" 2>/dev/null || true
if [[ -f .env ]]; then
  cp -a .env "${BACKUP_ROOT}/${STAMP}/env.bak"
fi
echo "Backup written under ${BACKUP_ROOT}/${STAMP}"

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

cert_ok() {
  local cert="/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem"
  [[ -f "$cert" ]] || return 1
  openssl x509 -in "$cert" -noout -checkend 2592000 >/dev/null 2>&1 || return 1
  openssl x509 -in "$cert" -noout -text 2>/dev/null | grep -q "DNS:${SITE_HOST}" || return 1
  openssl x509 -in "$cert" -noout -text 2>/dev/null | grep -q "DNS:${WWW_HOST}" || return 1
  openssl x509 -in "$cert" -noout -text 2>/dev/null | grep -q "DNS:${ERP_HOST}" || return 1
}

if [[ "${SKIP_SSL:-0}" != "1" ]]; then
  if cert_ok; then
    echo "KEEP St. Luke's certificate ${CERT_NAME} (valid + required SANs)"
  else
    echo "Issuing/expanding Let's Encrypt cert: ${CERT_NAME}"
    "${COMPOSE[@]}" up -d nginx
    sleep 3
    PROBE="sls-acme-${STAMP}"
    echo "ok-${PROBE}" > "certbot/www/.well-known/acme-challenge/${PROBE}"
    for h in "$SITE_HOST" "$WWW_HOST" "$ERP_HOST"; do
      body="$(curl -4 -sS --max-time 15 "http://${h}/.well-known/acme-challenge/${PROBE}" || true)"
      if [[ "$body" != "ok-${PROBE}" ]]; then
        echo "ERROR: ACME HTTP-01 probe failed for ${h} (got: ${body:0:80})" >&2
        echo "Wait for DNS A records (@, www, erp → this VPS), then re-run." >&2
        rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"
        exit 1
      fi
      echo "OK ACME probe ${h}"
    done
    rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"

    certbot certonly \
      --webroot -w "${APP_DIR}/certbot/www" \
      --cert-name "$CERT_NAME" \
      -d "$SITE_HOST" -d "$WWW_HOST" -d "$ERP_HOST" \
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

TEMPLATE="${APP_DIR}/scripts/deploy/templates/st-lukes-nginx.conf.template"
TARGET="${APP_DIR}/nginx/extra-sites.d/st-lukes-tura.conf"
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

if [[ -f .env ]]; then
  python3 - <<'PY'
from pathlib import Path
import os
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

cors = keys.get("CORS_EXTRA_ORIGINS", "")
parts = [p.strip() for p in cors.split(",") if p.strip()]
for origin in (
    "https://stlukestura.in",
    "https://www.stlukestura.in",
    "https://erp.stlukestura.in",
):
    if origin not in parts:
        parts.append(origin)
keys["CORS_EXTRA_ORIGINS"] = ",".join(parts)
keys["COOKIE_SECURE"] = "true"
keys["SCHOOL_WEB_SMTP_HOST"] = keys.get("SCHOOL_WEB_SMTP_HOST") or "smtp.hostinger.com"
keys["SCHOOL_WEB_SMTP_PORT"] = keys.get("SCHOOL_WEB_SMTP_PORT") or "465"
keys["SCHOOL_WEB_SMTP_SECURE"] = keys.get("SCHOOL_WEB_SMTP_SECURE") or "true"
keys["SCHOOL_WEB_SMTP_USER"] = "admin@stlukestura.in"
keys["SCHOOL_WEB_SMTP_FROM"] = "admin@stlukestura.in"
keys["SCHOOL_WEB_SMTP_FROM_NAME"] = "St. Luke's Secondary School, Tura"
pw = os.environ.get("SCHOOL_WEB_SMTP_PASS", "").replace(" ", "").strip()
if pw:
    keys["SCHOOL_WEB_SMTP_PASS"] = pw

def dump_kv(k, v):
    s = str(v)
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        return f"{k}={s}"
    if any(ch in s for ch in " \t'\"$`#"):
        escaped = (
            s.replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("$", "\\$")
            .replace("`", "\\`")
        )
        return f'{k}="{escaped}"'
    return f"{k}={s}"

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
    out.append(dump_kv(k, keys[k]))
for k, v in keys.items():
    if k not in seen:
        out.append(dump_kv(k, v))
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("Patched .env CORS and St. Luke's SMTP mailbox (password only if SCHOOL_WEB_SMTP_PASS was set)")
PY
  if ! grep -q '^SCHOOL_WEB_SMTP_PASS=.\+' .env; then
    echo "WARN: SCHOOL_WEB_SMTP_PASS is empty. Re-run with SCHOOL_WEB_SMTP_PASS set so website enquiries can email admin@stlukestura.in"
  fi
else
  echo "WARN: no .env — create from scripts/deploy/production.env.example first"
fi

if [[ "${SKIP_CODE_DEPLOY:-0}" != "1" ]]; then
  echo
  echo "Deploying application code via vps-update-erp-safe.sh…"
  bash scripts/deploy/vps-update-erp-safe.sh
else
  echo "SKIP_CODE_DEPLOY=1 — recreating api so CORS env is loaded"
  "${COMPOSE[@]}" up -d api
fi

echo
echo "Ensuring St. Luke's tenant / domains / website CMS…"
"${COMPOSE[@]}" exec -T api npx tsx scripts/ensure-st-lukes-school.ts || \
  echo "WARN: ensure-st-lukes-school failed — run it after the API image includes the script"

echo
echo "--- St. Luke's SSL / app checks ---"
for url in \
  "https://${SITE_HOST}/" \
  "https://${WWW_HOST}/" \
  "https://${ERP_HOST}/login" \
  "https://${SITE_HOST}/api/health/live"
do
  code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)"
  echo "  ${code}  ${url}"
done

CTX="$(curl -sk --max-time 20 -H "X-Login-Host: ${ERP_HOST}" \
  "https://${ERP_HOST}/api/v1/auth/context" || true)"
echo "  erp login-context: ${CTX:0:180}"

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
echo "Public site: https://${SITE_HOST}/"
echo "School ERP:  https://${ERP_HOST}/login"
echo "Rollback (if needed):"
echo "  cp ${BACKUP_ROOT}/${STAMP}/nginx.conf.bak ${APP_DIR}/nginx/nginx.conf"
echo "  cp -a ${BACKUP_ROOT}/${STAMP}/extra-sites.d/. ${APP_DIR}/nginx/extra-sites.d/"
echo "  cp ${BACKUP_ROOT}/${STAMP}/env.bak ${APP_DIR}/.env"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec -T nginx nginx -s reload"
exit "$fail"
