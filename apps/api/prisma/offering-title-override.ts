import type { PrismaClient } from '@prisma/client';
import { offeringTitleOverride } from '../src/modules/academic-engine/domain/offering-paper-title';

export async function resolveMappingTitleOverride(
  prisma: PrismaClient,
  courseId: string,
  mappingTitle: string,
): Promise<string | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  });
  return offeringTitleOverride(course?.title, mappingTitle);
}
