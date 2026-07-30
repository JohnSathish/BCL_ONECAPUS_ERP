# IQAC public hub (`/iqac`)

Dedicated college-web IQAC section with sidebar navigation and Website CMS–managed content.

## Public URLs

| Path                  | Content                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `/iqac`               | Overview (CMS)                                                           |
| `/iqac/aqar`          | AQAR (CMS)                                                               |
| `/iqac/members`       | Optional CMS intro + **Governance** committee members (`shortCode=IQAC`) |
| `/iqac/meetings`      | Meetings (CMS)                                                           |
| `/iqac/action-report` | Action Report (CMS)                                                      |

`/about/administration/iqac` permanently redirects to `/iqac`.

## Admin checklist (Website SMD)

1. Open **Admin → Website → Pages**.
2. Ensure these paths exist (import catalogue / seed if missing):
   - `/iqac`, `/iqac/aqar`, `/iqac/members`, `/iqac/meetings`, `/iqac/action-report`
3. Edit body HTML independently for each page.
4. **Publish** each page (status `PUBLISHED`).
5. Do **not** paste a member roster into CMS — manage members under **Governance → Committees → IQAC**.

## Committee members

- Source of truth: Governance committee with `shortCode = IQAC`.
- Public API: `GET /api/v1/website/public/committees/IQAC/members?tenant=demo`
- College-web Members tab loads this automatically.

## VPS deploy

```bash
# API (new public members endpoint)
cd /opt/nep-erp && bash scripts/deploy/vps-update-erp-safe.sh

# College website rebuild
bash scripts/deploy/vps-rebuild-college-web.sh
```

Optional — import new catalogue pages if they are missing:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec api \
  npx tsx -e "/* use Website CMS Seed / Import Catalogue from admin UI */"
```

Prefer **Admin → Website → Import catalogue / Seed defaults** when available, then publish the IQAC pages.
