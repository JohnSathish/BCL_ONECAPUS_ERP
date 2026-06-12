import { PrismaClient } from '@prisma/client';
import { resolveVtcTrackFields } from '../src/common/services/vtc-track-metadata';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const courses = await prisma.course.findMany({
    where: {
      deletedAt: null,
      OR: [
        { code: { startsWith: 'VTC', mode: 'insensitive' } },
        { offerings: { some: { category: 'VTC', deletedAt: null } } },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      vtcTrackGroupCode: true,
      vtcTrackStage: true,
    },
  });

  console.log(`Found ${courses.length} VTC-related courses`);
  for (const course of courses) {
    const resolved = resolveVtcTrackFields({
      code: course.code,
      title: course.title,
      vtcTrackGroupCode: course.vtcTrackGroupCode,
      vtcTrackStage: course.vtcTrackStage,
    });
    const needsUpdate =
      resolved.vtcTrackGroupCode !== course.vtcTrackGroupCode ||
      resolved.vtcTrackStage !== course.vtcTrackStage;

    console.log(
      `${course.code}: group=${resolved.vtcTrackGroupCode} stage=${resolved.vtcTrackStage}${needsUpdate ? ' (update)' : ''}`,
    );

    if (apply && needsUpdate) {
      await prisma.course.update({
        where: { id: course.id },
        data: {
          vtcTrackGroupCode: resolved.vtcTrackGroupCode,
          vtcTrackStage: resolved.vtcTrackStage,
        },
      });
    }
  }

  if (!apply) console.log('\nRe-run with --apply to persist.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
