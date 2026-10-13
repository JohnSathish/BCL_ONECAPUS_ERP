import type { PrismaService } from '../../../database/prisma.service';
import { registrationPaperTitle } from '../../academic-engine/domain/offering-paper-title';
import { syncSharedCodeMinorTitles } from '../../academic-engine/services/shared-code-minor-title.sync';

const refreshedAt = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();

function categoryFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null;
  const category = (metadata as { category?: unknown }).category;
  return typeof category === 'string' ? category : null;
}

/**
 * Rewrite sitting names from the current curriculum. Admit cards and mark
 * entry otherwise keep the title that was copied when the paper was created.
 */
export function refreshExamPaperNames(
  prisma: PrismaService,
  tenantId: string,
  sessionId: string,
) {
  const key = `${tenantId}:${sessionId}`;
  const recent = refreshedAt.get(key);
  if (recent && Date.now() - recent < 20_000) return Promise.resolve();
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = applyExamPaperNames(prisma, tenantId, sessionId).finally(() => {
    inflight.delete(key);
    refreshedAt.set(key, Date.now());
  });
  inflight.set(key, job);
  return job;
}

async function applyExamPaperNames(
  prisma: PrismaService,
  tenantId: string,
  sessionId: string,
) {
  await syncSharedCodeMinorTitles(prisma, tenantId);
  const papers = await prisma.examPaperSchedule.findMany({
    where: { tenantId, sessionId, deletedAt: null },
    select: {
      id: true,
      paperName: true,
      metadata: true,
      courseId: true,
      offeringId: true,
    },
  });
  if (!papers.length) return;

  const courseIds = [
    ...new Set(
      papers
        .map((paper) => paper.courseId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const offeringIds = [
    ...new Set(
      papers
        .map((paper) => paper.offeringId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [courses, offerings] = await Promise.all([
    courseIds.length
      ? prisma.course.findMany({
          where: { tenantId, id: { in: courseIds } },
          select: { id: true, code: true, title: true },
        })
      : [],
    offeringIds.length
      ? prisma.courseOffering.findMany({
          where: { tenantId, id: { in: offeringIds } },
          select: { id: true, category: true, titleOverride: true },
        })
      : [],
  ]);
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const offeringById = new Map(
    offerings.map((offering) => [offering.id, offering]),
  );

  for (const paper of papers) {
    const offering = paper.offeringId
      ? offeringById.get(paper.offeringId)
      : undefined;
    const course = paper.courseId ? courseById.get(paper.courseId) : undefined;
    const next = registrationPaperTitle(
      course,
      offering,
      offering?.category ?? categoryFromMetadata(paper.metadata),
    );
    if (!next || next === paper.paperName) continue;
    await prisma.examPaperSchedule.update({
      where: { id: paper.id },
      data: { paperName: next },
    });
  }
}
