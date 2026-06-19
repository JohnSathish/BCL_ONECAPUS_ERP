import { join } from 'path';

/** Writable upload root — respects UPLOAD_ROOT in Docker (/data/uploads). */
export function resolveUploadRoot(): string {
  const configured = process.env.UPLOAD_ROOT?.trim();
  if (configured) return configured;
  return join(process.cwd(), 'uploads');
}

/** Tenant-scoped uploads: /data/uploads/tenants in production. */
export function resolveTenantUploadRoot(): string {
  return join(resolveUploadRoot(), 'tenants');
}

/** Document storage root — respects STORAGE_ROOT in Docker (/data/storage). */
export function resolveStorageRoot(): string {
  const configured = process.env.STORAGE_ROOT?.trim();
  if (configured) return configured;
  return join(process.cwd(), 'storage');
}
