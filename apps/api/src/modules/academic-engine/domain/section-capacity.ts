import type { PrismaClient } from '@prisma/client';
import {
  DEFAULT_SHARED_POOL_SECTION_CAPACITY,
  LEGACY_DEFAULT_POOL_CAPACITY,
} from '../../../common/constants/academic-capacity';
import { MAPPING_SOURCE } from './category-pools';

/** Shared/common pool categories that use institution-wide section defaults. */
export const SHARED_POOL_CAPACITY_CATEGORIES = [
  'AEC',
  'MDC',
  'SEC',
  'VAC',
  'VTC',
] as const;

export type SharedPoolCapacityCategory =
  (typeof SHARED_POOL_CAPACITY_CATEGORIES)[number];

export { DEFAULT_SHARED_POOL_SECTION_CAPACITY, LEGACY_DEFAULT_POOL_CAPACITY };

const HONOURS_STUDENT_GROUPS = new Set(['HONOURS', 'HONOR', 'HONORS']);

export function isSharedPoolCapacityCategory(
  category: string | null | undefined,
): category is SharedPoolCapacityCategory {
  if (!category) return false;
  return (SHARED_POOL_CAPACITY_CATEGORIES as readonly string[]).includes(
    category.trim().toUpperCase(),
  );
}

export function isSharedPoolOffering(input: {
  mappingSource?: string | null;
  category?: string | null;
  programVersionId?: string | null;
}): boolean {
  if (input.mappingSource === MAPPING_SOURCE.SHARED_POOL) return true;
  if (
    input.programVersionId == null &&
    isSharedPoolCapacityCategory(input.category)
  ) {
    return true;
  }
  return false;
}

export function isHonoursRestrictedSection(
  studentGroup: string | null | undefined,
): boolean {
  if (!studentGroup) return false;
  return HONOURS_STUDENT_GROUPS.has(studentGroup.trim().toUpperCase());
}

export function isLegacyDefaultPoolCapacity(
  capacity: number | null | undefined,
): boolean {
  return capacity === LEGACY_DEFAULT_POOL_CAPACITY;
}

export function readSharedPoolCapacityFromPolicy(
  creditPolicy: unknown,
): number {
  if (!creditPolicy || typeof creditPolicy !== 'object') {
    return DEFAULT_SHARED_POOL_SECTION_CAPACITY;
  }
  const value = (creditPolicy as { defaultSharedPoolCapacity?: unknown })
    .defaultSharedPoolCapacity;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_SHARED_POOL_SECTION_CAPACITY;
  }
  return Math.floor(value);
}

export async function resolveTenantSharedPoolCapacity(
  prisma: Pick<PrismaClient, 'tenantAcademicSettings'>,
  tenantId: string,
): Promise<number> {
  const settings = await prisma.tenantAcademicSettings.findUnique({
    where: { tenantId },
    select: { creditPolicy: true },
  });
  return readSharedPoolCapacityFromPolicy(settings?.creditPolicy);
}

export function resolveSharedPoolSectionCapacity(input: {
  explicitCapacity?: number | null;
  offeringCapacity?: number | null;
  tenantDefaultCapacity: number;
}): number {
  if (input.explicitCapacity != null && input.explicitCapacity > 0) {
    return input.explicitCapacity;
  }
  if (
    input.offeringCapacity != null &&
    input.offeringCapacity > 0 &&
    !isLegacyDefaultPoolCapacity(input.offeringCapacity)
  ) {
    return input.offeringCapacity;
  }
  return input.tenantDefaultCapacity;
}
