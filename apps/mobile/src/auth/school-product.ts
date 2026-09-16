import type { SchoolConfig } from '@/types/school';

export function isSchoolSisConfig(
  config: Pick<SchoolConfig, 'product' | 'tenantSlug'> | null | undefined,
) {
  if (!config) return false;
  if (config.product === 'school-sis') return true;
  return config.tenantSlug === 'st-lukes-tura' || config.tenantSlug.startsWith('st-lukes');
}
