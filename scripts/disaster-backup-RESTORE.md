# 1505NEWERP Disaster Recovery Restore Guide

## Contents

- database/nep_erp.dump - PostgreSQL custom-format dump (pg_restore)
- data/storage/ - API storage root (journals, documents, etc.)
- data/uploads/ - Tenant uploads (photos, branding, documents)
- config/ - Environment files and git snapshot at backup time
- source/ - Full project source tree

## Restore on a new machine

### 1. Prerequisites

- Node.js 22+, Docker Desktop, Git
- PostgreSQL client tools (pg_restore) OR use Docker postgres container

### 2. Extract archive

```
tar -xzf 1505NEWERP-DR-YYYYMMDD-HHMMSS.tar.gz -C E:\Projects\
cd E:\Projects\DR-YYYYMMDD-HHMMSS\source
npm install
```

### 3. Restore environment files

Copy from config/ back to project paths (filenames use \_\_ for path separators).

### 4. Start infrastructure

```
docker compose up -d postgres redis
```

### 5. Restore database

```
docker cp database/nep_erp.dump 1505newerp-postgres-1:/tmp/restore.dump
docker exec 1505newerp-postgres-1 pg_restore -U nep -d nep_erp --clean --if-exists --no-owner --no-acl /tmp/restore.dump
```

### 6. Restore data files

- Copy data/storage to apps/api/storage
- Copy data/uploads to apps/api/uploads

### 7. Migrations and dev

```
cd apps/api && npx prisma migrate deploy
cd ../.. && npm run dev
```

## Notes

- Redis data is not included (cache/queues rebuild automatically).
- Run npm install after restore.
- Android/iOS build folders were excluded from source copy.
