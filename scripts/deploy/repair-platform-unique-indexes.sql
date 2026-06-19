-- Repair platform unique indexes required by Prisma upsert (seed, bootstrap).
-- Safe to re-run: uses IF NOT EXISTS.
-- Run after pg_restore if seed fails with Postgres 42P10.

\set ON_ERROR_STOP on

\echo 'Checking duplicate tenant slugs…'
SELECT slug, COUNT(*) AS n
FROM platform.tenants
GROUP BY slug
HAVING COUNT(*) > 1;

\echo 'Creating platform unique indexes…'
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON platform.tenants (slug);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_domains_host_key" ON platform.tenant_domains (host);
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_email_key" ON platform.users (tenant_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS "roles_tenant_id_slug_key" ON platform.roles (tenant_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_slug_key" ON platform.permissions (slug);

\echo 'Done.'
