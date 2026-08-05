# Migrate Batch 2024 Students (Offline → Live)

Secure dual-database copy of **genuine BATCH-2024** students from an offline Postgres into live. Existing live rows are never updated or deleted.

Script: [`apps/api/scripts/migrate-batch-2024-offline-to-live.ts`](../apps/api/scripts/migrate-batch-2024-offline-to-live.ts)

## What is included

- User + student role, Student, StudentProfile
- Academic profile (batch `BATCH-2024`), standing, program choices
- Guardians, addresses
- Major/minor track, VTC track (offerings left null if unmapped), academic tracks
- Semester registrations + lines (offerings remapped by course code / semester sequence)

## What is excluded

- Demo / `@demo.edu` / `DEMO-*` / `DEMO_SEED` / “Demo Student …” names
- Students whose roll does **not** match `^(BA|BSC|BCOM|BSW|BCA|BAM)24-`
- Fee ledgers / payments
- Binary photo files (profile stores `photoPath` only — sync `/data/uploads` separately if needed)

## Prerequisites

1. Live already has masters: programmes, shifts, `BATCH-2024` admission batch, courses/offerings/sections for Sem 5 (or target semester).
2. Network access to **both** databases from the machine running the script.
3. Offline and live tenant slug match (default `demo`).

## Dry run (preview)

```bash
cd /opt/nep-erp/apps/api   # or local apps/api

export SOURCE_DATABASE_URL='postgresql://USER:PASS@OFFLINE_HOST:5432/nep_erp'
export TARGET_DATABASE_URL='postgresql://USER:PASS@LIVE_HOST:5432/nep_erp'
export TENANT_SLUG='demo'

npx tsx scripts/migrate-batch-2024-offline-to-live.ts
```

PowerShell:

```powershell
cd E:\Projects\1505NEWERP\apps\api
$env:SOURCE_DATABASE_URL='postgresql://...'
$env:TARGET_DATABASE_URL='postgresql://...'
$env:TENANT_SLUG='demo'
npx tsx scripts/migrate-batch-2024-offline-to-live.ts
```

Review console totals and JSON under `apps/api/storage/migration-reports/batch-2024-*.json`.

## Apply

```bash
CONFIRM=YES npx tsx scripts/migrate-batch-2024-offline-to-live.ts
```

PowerShell: `$env:CONFIRM='YES'`

Each student is inserted in its own target transaction. Failures roll back **that** student only.

## Duplicate rules

Skip when live already has the same `enrollmentNumber` or `rollNumber` (or the same non-synthetic portal email).

## Verify on live

1. Student Directory — search `BA24-` (and other `*24-` prefixes).
2. Open a migrated profile: programme, major, shift, semester, guardians.
3. Confirm a pre-existing live student was **not** changed (should appear as `SKIP_DUPLICATE` in the report).
4. Confirm no demo emails were created.

## Optional: photo files

If `photoPath` points at `/uploads/...` that only exist offline:

```bash
# example — adjust tenant path
rsync -avz offline:/data/uploads/tenants/<tenantId>/students/ live:/data/uploads/tenants/<tenantId>/students/
```

Then rebuild/restart API if needed and confirm avatars in the directory.
