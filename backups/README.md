# Database backups

## Restore

```bash
# Ensure Postgres is running (docker-compose up -d postgres)
psql -h 127.0.0.1 -p 15432 -U nep -d nep_erp -f backups/nep_erp_20250603.sql
```

Default credentials match `apps/api/.env.example` (not committed).

## Files

| File                   | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `nep_erp_20250603.sql` | Full PostgreSQL dump of `nep_erp` (schema + data) |
