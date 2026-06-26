import type { Prisma } from '@prisma/client';
import { courseMatchesSubjectPath } from './course-subject-slug';

export type PriorLineContext = {
  offeringId: string;
  category: string;
  majorPaperIndex?: number | null;
  course: {
    id: string;
    code: string;
    departmentId?: string | null;
    subjectSlug?: string | null;
    title?: string | null;
    department?: { id: string; code: string; name: string } | null;
  };
};

type DbClient =
  | Prisma.TransactionClient
  | {
      programPromotionMapping: Prisma.ProgramPromotionMappingDelegate;
      courseOffering: Prisma.CourseOfferingDelegate;
    };

export async function findExplicitPromotionMapping(
  db: DbClient,
  programVersionId: string,
  fromOfferingId: string,
  toSequence: number,
): Promise<string | null> {
  const row = await db.programPromotionMapping.findFirst({
    where: { programVersionId, fromOfferingId, toSequence },
    select: { toOfferingId: true },
  });
  return row?.toOfferingId ?? null;
}

export async function resolveSuccessorOfferingId(
  db: DbClient,
  opts: {
    tenantId: string;
    programVersionId: string;
    toSequence: number;
    priorLine: PriorLineContext;
    subjectSlug?: string | null;
  },
): Promise<string | null> {
  const explicit = await findExplicitPromotionMapping(
    db,
    opts.programVersionId,
    opts.priorLine.offeringId,
    opts.toSequence,
  );
  if (explicit) return explicit;

  const category = opts.priorLine.category.toUpperCase();
  const departmentId = opts.priorLine.course.departmentId;
  const majorPaperIndex = opts.priorLine.majorPaperIndex;

  const candidates = await db.courseOffering.findMany({
    where: {
      tenantId: opts.tenantId,
      programVersionId: opts.programVersionId,
      semesterSequence: opts.toSequence,
      deletedAt: null,
      category: { equals: category, mode: 'insensitive' },
      ...(majorPaperIndex != null ? { majorPaperIndex } : {}),
      ...(departmentId ? { course: { departmentId } } : {}),
    },
    include: {
      course: { include: { department: true } },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  if (candidates.length === 0) return null;

  if (
    (category === 'MAJOR' || category === 'MINOR') &&
    opts.subjectSlug?.trim()
  ) {
    const matched = candidates.filter((offering) =>
      courseMatchesSubjectPath(offering.course, opts.subjectSlug!),
    );
    if (matched.length > 0) return matched[0]!.id;
  }

  return candidates[0]!.id;
}

export function priorLineSlotKey(
  category: string,
  majorPaperIndex?: number | null,
): string {
  if (category === 'MAJOR' && majorPaperIndex != null) {
    return `MAJOR-${majorPaperIndex}`;
  }
  return category.toUpperCase();
}

export async function buildPriorLineContextMap(
  db: DbClient,
  priorLines: Array<{
    category: string;
    offeringId: string;
    offering?: {
      majorPaperIndex?: number | null;
      course: PriorLineContext['course'];
    } | null;
  }>,
): Promise<Map<string, PriorLineContext>> {
  const map = new Map<string, PriorLineContext>();
  const majorLines = priorLines.filter((l) => l.category === 'MAJOR');
  for (let i = 0; i < majorLines.length; i++) {
    const line = majorLines[i]!;
    const offering = line.offering;
    if (!offering) continue;
    map.set(`MAJOR-${i + 1}`, {
      offeringId: line.offeringId,
      category: 'MAJOR',
      majorPaperIndex: offering.majorPaperIndex ?? i + 1,
      course: offering.course,
    });
  }
  for (const line of priorLines) {
    if (line.category === 'MAJOR') continue;
    const offering = line.offering;
    if (!offering) continue;
    map.set(line.category.toUpperCase(), {
      offeringId: line.offeringId,
      category: line.category.toUpperCase(),
      majorPaperIndex: offering.majorPaperIndex,
      course: offering.course,
    });
  }
  return map;
}
