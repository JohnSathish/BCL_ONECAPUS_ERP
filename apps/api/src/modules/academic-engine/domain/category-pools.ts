import { isStructureCategoryType } from './nep-categories';

/** Categories eligible for shared pools (MAJOR/MINOR remain programme-specific). */
export const POOL_ELIGIBLE_CATEGORIES = [
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
] as const;

export type PoolEligibleCategory = (typeof POOL_ELIGIBLE_CATEGORIES)[number];

export const MAPPING_SOURCE = {
  DIRECT: 'DIRECT',
  SHARED_POOL: 'SHARED_POOL',
} as const;

export type MappingSource =
  (typeof MAPPING_SOURCE)[keyof typeof MAPPING_SOURCE];

export function isPoolEligibleCategory(
  value: string,
): value is PoolEligibleCategory {
  return (POOL_ELIGIBLE_CATEGORIES as readonly string[]).includes(value);
}

export function assertPoolEligibleCategory(
  value: string,
): PoolEligibleCategory {
  const normalized = value.trim().toUpperCase();
  if (!isPoolEligibleCategory(normalized)) {
    throw new Error(
      `Category "${value}" is not eligible for shared pools. Allowed: ${POOL_ELIGIBLE_CATEGORIES.join(', ')}`,
    );
  }
  return normalized;
}

export function assignmentSourceForPool(poolId: string): string {
  return `${MAPPING_SOURCE.SHARED_POOL}:${poolId}`;
}

export function parseAssignmentSource(source?: string | null): {
  mappingSource: MappingSource;
  poolId?: string;
} {
  if (!source) return { mappingSource: MAPPING_SOURCE.DIRECT };
  if (source === MAPPING_SOURCE.DIRECT)
    return { mappingSource: MAPPING_SOURCE.DIRECT };
  if (source.startsWith(`${MAPPING_SOURCE.SHARED_POOL}:`)) {
    return {
      mappingSource: MAPPING_SOURCE.SHARED_POOL,
      poolId: source.slice(`${MAPPING_SOURCE.SHARED_POOL}:`.length),
    };
  }
  if (source === MAPPING_SOURCE.SHARED_POOL) {
    return { mappingSource: MAPPING_SOURCE.SHARED_POOL };
  }
  return { mappingSource: MAPPING_SOURCE.DIRECT };
}

export function isStructureOrPoolCategory(value: string): boolean {
  return isStructureCategoryType(value) || isPoolEligibleCategory(value);
}
