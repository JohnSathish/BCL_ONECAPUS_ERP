#!/usr/bin/env bash
# Host BaseCode Labs + BaseCode Central on the shared DBC VPS (82.25.110.120)
# WITHOUT replacing Don Bosco / Mercy / Diocese / TPS / St. Luke's nginx or certificates.
#
# Domains:
#   https://basecodelabs.com       → company site + Central
#   https://www.basecodelabs.com   → 301 to apex
#
# Does NOT add basecodelabs.com to the erp.donboscocollege.ac.in certificate.
#
# Prerequisites:
#   - DNS A for @ and www already point at 82.25.110.120
#   - /opt/nep-erp is the live monorepo (git pull first)
#
# Usage:
#   cd /opt/nep-erp && git pull origin master
#   bash scripts/deploy/vps-configure-basecode-labs.sh
#   SMTP_PASS='mailbox-password' bash scripts/deploy/vps-configure-basecode-labs.sh
#   SKIP_SSL=1 bash scripts/deploy/vps-configure-basecode-labs.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
EMAIL="${SSL_EMAIL:-contact@basecodelabs.com}"
CERT_NAME="${BCL_CERT_NAME:-basecodelabs.com}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/basecode-labs-pre-deploy}"
SITE_HOST="basecodelabs.com"
WWW_HOST="www.basecodelabs.com"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
BCL_COMPOSE=(
  docker compose
  -f docker-compose.yml
  -f docker-compose.prod.yml
  -f docker-compose.basecode-labs.yml
  --profile local-db
)

cd "$APP_DIR"

echo "=== BaseCode Labs — isolated production configure ==="
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
probe sls_site "https://stlukestura.in/" || true
probe tps_adm "https://admission.turapublicschool.com/" || true

STAMP="$(date +%Y%m%d%H%M%S)"
mkdir -p "${BACKUP_ROOT}/${STAMP}"
cp -a nginx/nginx.conf "${BACKUP_ROOT}/${STAMP}/nginx.conf.bak" 2>/dev/null || true
cp -a nginx/extra-sites.d "${BACKUP_ROOT}/${STAMP}/extra-sites.d" 2>/dev/null || true
[[ -f .env ]] && cp -a .env "${BACKUP_ROOT}/${STAMP}/env.bak"
[[ -f .env.basecode-labs ]] && cp -a .env.basecode-labs "${BACKUP_ROOT}/${STAMP}/env.basecode-labs.bak"
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
}

if [[ "${SKIP_SSL:-0}" != "1" ]]; then
  if cert_ok; then
    echo "KEEP BaseCode Labs certificate ${CERT_NAME}"
  else
    echo "Issuing Let's Encrypt cert: ${CERT_NAME} (separate from Don Bosco)"
    "${COMPOSE[@]}" up -d nginx
    sleep 3
    PROBE="bcl-acme-${STAMP}"
    echo "ok-${PROBE}" > "certbot/www/.well-known/acme-challenge/${PROBE}"
    for h in "$SITE_HOST" "$WWW_HOST"; do
      body="$(curl -4 -sS --max-time 15 "http://${h}/.well-known/acme-challenge/${PROBE}" || true)"
      if [[ "$body" != "ok-${PROBE}" ]]; then
        echo "ERROR: ACME HTTP-01 probe failed for ${h} (got: ${body:0:80})" >&2
        echo "Point DNS A for @ and www to 82.25.110.120, wait, then re-run." >&2
        rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"
        exit 1
      fi
      echo "OK ACME probe ${h}"
    done
    rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"

    certbot certonly \
      --webroot -w "${APP_DIR}/certbot/www" \
      --cert-name "$CERT_NAME" \
      -d "$SITE_HOST" -d "$WWW_HOST" \
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

if [[ ! -f .env.basecode-labs ]]; then
  cp scripts/deploy/basecode-labs.env.example .env.basecode-labs
  echo "Created .env.basecode-labs from example"
fi

python3 - <<'PY'
from pathlib import Path
import os, secrets, subprocess

def load(path: Path):
    keys, order = {}, []
    if not path.exists():
        return keys, order
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            order.append(("raw", line))
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        keys[k] = v
        order.append(("kv", k))
    return keys, order

def dump_kv(k, v):
    s = str(v)
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        return f"{k}={s}"
    if any(ch in s for ch in " \t'\"$`#"):
        escaped = s.replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$").replace("`", "\\`")
        return f'{k}="{escaped}"'
    return f"{k}={s}"

def write(path: Path, keys, order):
    seen, out = set(), []
    for kind, val in order:
        if kind == "raw":
            out.append(val)
            continue
        if val in seen:
            continue
        seen.add(val)
        out.append(dump_kv(val, keys[val]))
    for k, v in keys.items():
        if k not in seen:
            out.append(dump_kv(k, v))
    path.write_text("\n".join(out) + "\n", encoding="utf-8")

def rand():
    return subprocess.check_output(["openssl", "rand", "-base64", "32"], text=True).strip()

weak = {"", "change-me", "change-me-too", "YOUR_LONG_RANDOM_SHARED_SECRET"}
bcl_path = Path(".env.basecode-labs")
nep_path = Path(".env")
bcl, bcl_order = load(bcl_path)
nep, nep_order = load(nep_path)

smtp = os.environ.get("SMTP_PASS", "").strip()
if smtp:
    bcl["SMTP_PASS"] = smtp

for key in ("JWT_SECRET", "LICENSE_SIGNING_SECRET"):
    raw = str(bcl.get(key, "")).strip().strip('"').strip("'")
    if raw in weak:
        bcl[key] = rand()

shared = str(bcl.get("BASECODE_LICENSE_API_SECRET", "")).strip().strip('"').strip("'")
if shared in weak:
    shared = str(nep.get("BASECODE_LICENSE_API_SECRET", "")).strip().strip('"').strip("'")
if shared in weak:
    shared = rand()
bcl["BASECODE_LICENSE_API_SECRET"] = shared
bcl["APP_URL"] = "https://basecodelabs.com"
bcl["NODE_ENV"] = "production"
bcl["DATABASE_URL"] = "file:./data/prod.db"
write(bcl_path, bcl, bcl_order)

if nep_path.exists():
    nep["BASECODE_CENTRAL_URL"] = "http://basecode-labs:1610"
    nep["BASECODE_LICENSE_API_SECRET"] = shared
    write(nep_path, nep, nep_order)
    print("Patched NEP .env BASECODE_CENTRAL_URL + shared license secret")
print("BaseCode Labs env ready")
PY

TEMPLATE="${APP_DIR}/scripts/deploy/templates/basecode-labs-nginx.conf.template"
TARGET="${APP_DIR}/nginx/extra-sites.d/basecode-labs.conf"
if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: missing ${TEMPLATE}" >&2
  exit 1
fi
cp "$TEMPLATE" "$TARGET"
echo "Wrote ${TARGET}"

echo
echo "Building and starting basecode-labs (college/web/api images are not rebuilt)…"
"${BCL_COMPOSE[@]}" build basecode-labs
"${BCL_COMPOSE[@]}" up -d basecode-labs
echo "Waiting for basecode-labs…"
for _ in $(seq 1 40); do
  if docker exec basecode-labs node -e "fetch('http://127.0.0.1:1610/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

"${COMPOSE[@]}" exec -T nginx nginx -t
"${COMPOSE[@]}" up -d nginx
"${COMPOSE[@]}" exec -T nginx nginx -s reload || true
sleep 2

if [[ "${SKIP_ERP_RESTART:-0}" != "1" ]]; then
  echo "Recreating api so BASECODE_CENTRAL_URL is loaded (brief ERP API bounce)…"
  "${COMPOSE[@]}" up -d api
else
  echo "SKIP_ERP_RESTART=1 — set BASECODE_CENTRAL_URL then: docker compose ... up -d api"
fi

echo
if [[ "${SEED_BCL:-1}" == "1" ]]; then
  echo "Seeding Central only when no admin user exists…"
  if "${BCL_COMPOSE[@]}" exec -T basecode-labs node -e "
    const {PrismaClient}=require('@prisma/client');
    const p=new PrismaClient();
    p.user.count().then((c)=>process.exit(c>0?0:2)).finally(()=>p.\$disconnect());
  "; then
    echo "Admin user already present — skip full seed"
  else
    "${BCL_COMPOSE[@]}" exec -T basecode-labs npx tsx prisma/seed.ts || \
      "${BCL_COMPOSE[@]}" exec -T basecode-labs node prisma/ensure-admin.cjs || \
      echo "WARN: seed failed — run: docker exec -it basecode-labs npx tsx prisma/seed.ts"
  fi
  echo "Publishing legal policy pages…"
  "${BCL_COMPOSE[@]}" exec -T basecode-labs npx tsx prisma/seed-legal.ts || \
    echo "WARN: legal seed failed — run: docker exec -it basecode-labs npx tsx prisma/seed-legal.ts"
  echo "Publishing products and testimonials…"
  "${BCL_COMPOSE[@]}" exec -T basecode-labs npx tsx prisma/seed-catalog.ts || \
    echo "WARN: catalog seed failed — run: docker exec -it basecode-labs npx tsx prisma/seed-catalog.ts"
fi

echo
echo "--- BaseCode Labs checks ---"
for url in \
  "https://${SITE_HOST}/" \
  "https://${WWW_HOST}/" \
  "https://${SITE_HOST}/legal" \
  "https://${SITE_HOST}/legal/privacy-policy" \
  "https://${SITE_HOST}/privacy-policy.html" \
  "https://${SITE_HOST}/terms-and-conditions.html" \
  "https://${SITE_HOST}/admin/login"
do
  code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)"
  echo "  ${code}  ${url}"
done
san="$(echo | openssl s_client -servername "$SITE_HOST" -connect "${SITE_HOST}:443" 2>/dev/null \
  | openssl x509 -noout -text 2>/dev/null | grep -oE 'DNS:[^,[:space:]]+' | tr '\n' ' ' || true)"
echo "  certificate SANs: ${san}"

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
echo "Site:    https://${SITE_HOST}/"
echo "Central: https://${SITE_HOST}/admin/login"
echo "Set SMTP_PASS in .env.basecode-labs then: docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.basecode-labs.yml --profile local-db up -d basecode-labs"
echo "Rollback:"
echo "  rm -f ${APP_DIR}/nginx/extra-sites.d/basecode-labs.conf"
echo "  cp ${BACKUP_ROOT}/${STAMP}/nginx.conf.bak ${APP_DIR}/nginx/nginx.conf"
echo "  cp -a ${BACKUP_ROOT}/${STAMP}/extra-sites.d/. ${APP_DIR}/nginx/extra-sites.d/"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec -T nginx nginx -s reload"
exit "$fail"
