import type { PrismaClient } from '@prisma/client';

export type CatalogSeedExclusions = {
  excludedCourseCodes: Set<string>;
  excludedCurriculumKeys: Set<string>;
};

export function readCatalogSeedExclusions(
  nepProfile: Record<string, unknown> | null | undefined,
): CatalogSeedExclusions {
  const excludedCourseCodes = new Set<string>(
    Array.isArray(nepProfile?.excludedCourseCodes)
      ? (nepProfile!.excludedCourseCodes as string[])
      : [],
  );
  const excludedCurriculumKeys = new Set<string>(
    Array.isArray(nepProfile?.excludedCurriculumKeys)
      ? (nepProfile!.excludedCurriculumKeys as string[])
      : [],
  );
  return { excludedCourseCodes, excludedCurriculumKeys };
}

export async function mergeCatalogSeedExclusions(
  prisma: PrismaClient,
  tenantId: string,
  input: { courseCodes?: string[]; curriculumKeys?: string[] },
) {
  const existing = await prisma.tenantAcademicSettings.findUnique({
    where: { tenantId },
  });
  const profile =
    (existing?.nepProfile as Record<string, unknown> | null) ?? {};
  const current = readCatalogSeedExclusions(profile);

  if (input.courseCodes?.length) {
    for (const code of input.courseCodes) current.excludedCourseCodes.add(code);
  }
  if (input.curriculumKeys?.length) {
    for (const key of input.curriculumKeys) {
      current.excludedCurriculumKeys.add(key);
    }
  }

  const nepProfile = {
    ...profile,
    excludedCourseCodes: [...current.excludedCourseCodes],
    excludedCurriculumKeys: [...current.excludedCurriculumKeys],
  };

  await prisma.tenantAcademicSettings.upsert({
    where: { tenantId },
    create: { tenantId, nepProfile },
    update: { nepProfile },
  });
}

export function buildCurriculumOfferingKey(offering: {
  programVersionId: string | null;
  categoryPoolId?: string | null;
  course: { code: string };
  semesterSequence: number | null;
}) {
  const scope =
    offering.programVersionId ?? `pool:${offering.categoryPoolId ?? 'none'}`;
  return `${scope}:${offering.course.code}:${offering.semesterSequence ?? 0}`;
}
