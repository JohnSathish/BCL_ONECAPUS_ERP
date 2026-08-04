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

/**
 * Map public URL path `/uploads/...` to the on-disk location under UPLOAD_ROOT.
 * Never use process.cwd()/uploads — that breaks Docker when UPLOAD_ROOT=/data/uploads.
 */
export function resolvePublicUploadFsPath(publicPath: string): string {
  const cleaned = String(publicPath ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  const withoutUploadsPrefix = cleaned.replace(/^uploads\//, '');
  return join(resolveUploadRoot(), withoutUploadsPrefix);
}

/** Document storage root — respects STORAGE_ROOT in Docker (/data/storage). */
export function resolveStorageRoot(): string {
  const configured = process.env.STORAGE_ROOT?.trim();
  if (configured) return configured;
  return join(process.cwd(), 'storage');
}
