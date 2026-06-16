import type { PrismaClient } from '@prisma/client';

/** Mirrors TeachingSubjectGroupService.syncFromSemester for seed scripts. */
export async function syncSubjectGroupsForShift(
  prisma: PrismaClient,
  tenantId: string,
  shiftId: string,
  academicYearId: string,
  semesterNos: number[],
) {
  let created = 0;
  let updated = 0;
  const groupByCourseId = new Map<string, string>();

  for (const semesterNo of semesterNos) {
    const offerings = await prisma.courseOffering.findMany({
      where: {
        tenantId,
        deletedAt: null,
        semesterSequence: semesterNo,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            subjectSlug: true,
            departmentId: true,
          },
        },
        sections: {
          where: { deletedAt: null, shiftId },
          take: 1,
        },
      },
    });

    const buckets = new Map<
      string,
      {
        category: string;
        subjectSlug: string;
        departmentId?: string | null;
        courses: Array<{ id: string; offeringSectionId?: string }>;
      }
    >();

    for (const offering of offerings) {
      const course = offering.course;
      if (!course) continue;
      const slug =
        course.subjectSlug ??
        course.code.split('-')[0]?.toLowerCase() ??
        'general';
      const category = (offering.category ?? 'MAJOR').toUpperCase();
      const key = `${category}:${slug}:${semesterNo}`;
      const bucket = buckets.get(key) ?? {
        category,
        subjectSlug: slug,
        departmentId: course.departmentId,
        courses: [],
      };
      bucket.courses.push({
        id: course.id,
        offeringSectionId: offering.sections[0]?.id,
      });
      buckets.set(key, bucket);
    }

    for (const bucket of buckets.values()) {
      if (!bucket.courses.length) continue;
      const subject = await (prisma as any).academicSubject.findFirst({
        where: { tenantId, slug: bucket.subjectSlug, deletedAt: null },
      });
      const pretty = bucket.subjectSlug
        .split(/[-_\s]+/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
      const title =
        bucket.category === 'MAJOR'
          ? `Major ${pretty}`
          : bucket.category === 'MINOR'
            ? `Minor ${pretty}`
            : `${bucket.category} ${pretty}`;
      const code = `${bucket.category}-${bucket.subjectSlug.toUpperCase().replace(/[^A-Z0-9]/g, '')}-S${semesterNo}`;

      let group = await (prisma as any).teachingSubjectGroup.findFirst({
        where: { tenantId, code, deletedAt: null },
      });

      if (group) {
        await (prisma as any).teachingSubjectGroup.update({
          where: { id: group.id },
          data: {
            title,
            academicSubjectId: subject?.id ?? group.academicSubjectId,
            shiftId,
            departmentId: bucket.departmentId ?? group.departmentId,
            offeringSectionId:
              bucket.courses[0]?.offeringSectionId ?? group.offeringSectionId,
          },
        });
        updated += 1;
      } else {
        group = await (prisma as any).teachingSubjectGroup.create({
          data: {
            tenantId,
            code,
            title,
            academicSubjectId: subject?.id,
            academicYearId,
            semesterNo,
            shiftId,
            fyugpCategory: bucket.category,
            departmentId: bucket.departmentId,
            offeringSectionId: bucket.courses[0]?.offeringSectionId,
            status: 'ACTIVE',
          },
        });
        created += 1;
      }

      for (let i = 0; i < bucket.courses.length; i += 1) {
        const course = bucket.courses[i];
        await (prisma as any).teachingSubjectGroupPaper.upsert({
          where: {
            teachingSubjectGroupId_courseId: {
              teachingSubjectGroupId: group.id,
              courseId: course.id,
            },
          },
          create: {
            tenantId,
            teachingSubjectGroupId: group.id,
            courseId: course.id,
            paperIndex: i + 1,
            offeringSectionId: course.offeringSectionId,
          },
          update: {
            paperIndex: i + 1,
            offeringSectionId: course.offeringSectionId,
          },
        });
        groupByCourseId.set(course.id, group.id);
      }
    }
  }

  return { created, updated, groupByCourseId };
}
