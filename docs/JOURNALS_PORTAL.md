# Journals Portal — Phase 1–4 (+ 4b) + Content Migration

Multi-journal academic publishing portals in the same OneCampus monorepo (same pattern as Alumni / Admissions).

Production hosts (examples):

- **https://transient.donboscocollege.ac.in**
- **https://source.donboscocollege.ac.in**

Same Next.js app as ERP. Middleware: non-reserved first host label → `/journals-portal/*` with `X-Journal-Slug` ([`apps/web/middleware.ts`](../apps/web/middleware.ts)).

## Phase 1 (shipped)

- Prisma models: `Journal`, pages, announcements, editorial board, volumes, issues, articles, authors
- Public API: `GET/POST /v1/journals/portal/*`
- Admin CMS: `/admin/journals` (branding, pages, board, volumes/issues, articles)
- Seed: **Transient** and **Source** (Transient live ISSN from Google Sites: `2250-0650`)

## Phase 2 (OJS-lite — shipped)

- Portal register/login (`/journals-portal/login`, `/register`) — external accounts **and** ERP users (same JWT `User`)
- Author desk: draft → upload PDF → submit → revision resubmit
- Reviewer desk: accept/decline invite → submit recommendation
- Editor queue (Admin → Journals → **Submissions**): invite reviewers, decide (`SEND_TO_REVIEW` / `REVISE` / `ACCEPT` / `REJECT`), publish accepted work to an issue
- Roles: `journal_author`, `journal_reviewer`; permissions `journals:portal:author` / `journals:portal:reviewer`

### Submission status machine (editorial)

`DRAFT` → `SUBMITTED` → `IN_REVIEW` → (`REVISION_REQUIRED` → `RESUBMITTED` → `IN_REVIEW`)\* → `ACCEPTED` | `REJECTED` | `WITHDRAWN`

## Phase 3 (production + DOI + integrity — shipped)

After **Accept**, production pipeline:

`ACCEPTED` → `COPYEDITING` → `PROOFING` → `READY_TO_PUBLISH` → catalog publish

- Admin **Production** queue: advance stages, upload galley/proof, optional skip-to-ready from ACCEPTED
- Author: download proofs and **Approve proof** while `PROOFING` (moves to `READY_TO_PUBLISH`)
- Publish-to-issue **requires** `READY_TO_PUBLISH`
- **DOI**: per-journal Crossref settings (Admin → **DOI settings**); reserve + deposit. Without credentials → local mint + dry-run XML. With credentials → Crossref deposit API
- **Citations**: article detail Cite CSL / RIS / Crossref XML (`GET .../portal/articles/:id/cite`)
- **Analytics**: public home **Most viewed / Most downloaded** (`viewCount` / `downloadCount`)
- **Plagiarism**: editor uploads similarity score % + report PDF on submission (no Turnitin contract required)
- **Soft SSO**: login page **Continue with ERP** when `bootstrapSession` / existing JWT is present → `GET .../portal/auth/me` (`ensureAuthorAccess`) → author desk

Transient seed DOI prefix: `10.xxxxx` (demo dry-run).

### Phase 3 data

- `Journal`: `doiPrefix`, Crossref fields, `doiSequence`
- `JournalSubmission`: production notes, proof approval, `similarityScore` / report file
- `JournalSubmissionFile.kind`: `GALLEY`, `PROOF`, `SIMILARITY_REPORT`
- `JournalDoiRecord`, `JournalArticle.cslJson`

## Phase 4 (editorial notifications — shipped)

Email via `CommunicationTriggerService` (queued; `[dev-email]` when `SMTP_HOST` unset).

| Event                             | Template code                  | Recipient                      |
| --------------------------------- | ------------------------------ | ------------------------------ |
| Submit / resubmit                 | `JOURNAL_SUBMISSION_RECEIVED`  | Corresponding author           |
| New submission                    | `JOURNAL_SUBMISSION_TO_EDITOR` | `Journal.contactEmail`         |
| Reviewer invite                   | `JOURNAL_REVIEWER_INVITE`      | Reviewer (absolute invite URL) |
| Decision ACCEPT / REVISE / REJECT | `JOURNAL_DECISION`             | Corresponding author           |
| Entered PROOFING                  | `JOURNAL_PROOF_READY`          | Corresponding author           |
| Published                         | `JOURNAL_PUBLISHED`            | Corresponding author           |

Templates are in the default Communication catalog and upserted by `ensure-journals-portal.ts`.

## Phase 4b (discovery + reviewer UX — shipped)

**Discovery**

- `GET /v1/journals/portal/oai?verb=Identify|ListRecords|GetRecord|…` (OAI-PMH 2.0, `oai_dc`)
- Public proxy: `/oai` on journal hosts → [`journals-portal/oai/route.ts`](../apps/web/app/journals-portal/oai/route.ts)
- `GET /v1/journals/portal/sitemap` + Next [`journals-portal/sitemap.ts`](../apps/web/app/journals-portal/sitemap.ts) / [`robots.ts`](../apps/web/app/journals-portal/robots.ts)
- Article pages: Google Scholar `citation_*` meta + Open Graph (`generateMetadata`)

**Reviewer UX**

- Admin invite: optional **due date**
- Reviewer dashboard: totals / pending / completed / overdue
- Accept requires **conflict of interest** declaration (`conflictOfInterest` + notes if yes)
- Invite email link is absolute (`JOURNALS_PUBLIC_URL` / journal host)

## Local setup

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
npx tsx scripts/ensure-journals-portal.ts --tenant=demo

# Smoke Phase 1 public portal
npx tsx scripts/smoke-journals-portal.ts

# Smoke Phase 2 workflow (API on :3001)
npx tsx scripts/smoke-journals-workflow.ts

# Smoke Phase 3 production / DOI / cite / similarity / ERP continue
npx tsx scripts/smoke-journals-phase3.ts

# Smoke Phase 4 editorial emails
npx tsx scripts/smoke-journals-phase4.ts

# Smoke Phase 4b discovery + reviewer COI/due dates
npx tsx scripts/smoke-journals-phase4b.ts

# Transient content migration (Google Sites → CMS)
npx tsx scripts/import-journal-content.ts --tenant=demo --journal=transient --snapshot=./data/journals/transient/snapshot.json
# optional live crawl for volume PDF/cover discovery:
# npx tsx scripts/import-journal-content.ts ... --crawl-live
npx tsx scripts/smoke-journals-import-transient.ts
```

### Content migration (Google Sites → Journal CMS)

Reusable importer for Transient (and later Source):

```bash
npx tsx scripts/import-journal-content.ts \
  --tenant=demo \
  --journal=transient \
  --source=google-sites \
  --base-url=https://sites.google.com/donboscocollege.ac.in/transient \
  --snapshot=./data/journals/transient/snapshot.json
```

- Checked-in snapshot: [`apps/api/data/journals/transient/snapshot.json`](../apps/api/data/journals/transient/snapshot.json)
- Report JSON: `uploads/journals/import-reports/transient-*.json` (and StorageService)
- Idempotent upserts by page `key`, board name+boardType(+email), volume number/year, download fileName, media `originalUrl`
- Failed/ambiguous assets → `pendingReview` in the report (run continues)

**boardType glossary (canonical):**

| Value                  | Meaning                                   |
| ---------------------- | ----------------------------------------- |
| `CHIEF_PATRON`         | Chief Patron                              |
| `PATRON`               | Patron                                    |
| `CHIEF_EDITOR`         | Chief Editor                              |
| `COMMITTEE`            | Editorial committee                       |
| `ADVISORY`             | Advisory board (portal `/advisory-board`) |
| `EDITORIAL`            | Editorial board members                   |
| `PUBLISHER` / `OFFICE` | Publisher / office                        |
| `MANAGING` / `BOARD`   | Legacy aliases                            |

**Source reuse:** same CLI with `--journal=source` and a Source snapshot/adapter config under `data/journals/source/`.

Public portal: Downloads tab, Advisory Board page; middleware applies `JournalRedirect` (+ static Google Sites path fallbacks).

### Preview URLs

| URL                                                       | Notes                                         |
| --------------------------------------------------------- | --------------------------------------------- |
| `http://localhost:3000/journals-portal?journal=transient` | Public site (top viewed/downloaded)           |
| `http://localhost:3000/journals-portal/advisory-board`    | Advisory board (`boardType=ADVISORY`)         |
| `http://localhost:3000/journals-portal/downloads`         | Downloads library                             |
| `http://localhost:3000/journals-portal/login`             | Author/reviewer login + Continue with ERP     |
| `http://localhost:3000/journals-portal/author`            | Author submissions + proof approve            |
| `http://localhost:3000/journals-portal/reviewer`          | Reviewer assignments                          |
| `http://localhost:3000/admin/journals`                    | CMS + Downloads + Media + Board filters + SEO |

Hosts: `transient.demo.localhost`, `source.demo.localhost` (map → `127.0.0.1`).

## Architecture

```
{slug}.college.ac.in → Next middleware → /journals-portal
  → Nest journals/portal (+ author/reviewer JWT routes)
  → journalId-scoped PostgreSQL rows
Admin /admin/journals → Nest journals admin (editorial + production + DOI + downloads/media)
Workflow events → CommunicationTriggerService → BullMQ → SMTP or dev-log
Google Sites / snapshot → import-journal-content.ts → Journal CMS
```
