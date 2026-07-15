/**
 * Verify Sem-3 -> Sem-4 VTC continuity using the REAL continuity code
 * (StudentVtcTrackService.filterVtcSectionsSync) against the live DB.
 *
 * For one sample student per vocation, it confirms the Sem-4 VTC pool narrows
 * to exactly that student's Stage-II course (e.g. Desktop Publishing -> VTC-263.2).
 *
 *   npx ts-node -r tsconfig-paths/register scripts/verify-vtc-continuity.ts
 */
import { PrismaClient } from '@prisma/client';
import { StudentVtcTrackService } from '../src/modules/academic-engine/services/student-vtc-track.service';

const prisma = new PrismaClient();
const svc = new StudentVtcTrackService(prisma as never);

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo', deletedAt: null },
    select: { id: true },
  });
  if (!tenant) throw new Error('demo tenant not found');
  const tenantId = tenant.id;

  const sections = await prisma.offeringSection.findMany({
    where: {
      tenantId,
      deletedAt: null,
      courseOffering: {
        category: 'VTC',
        semesterSequence: 4,
        deletedAt: null,
        categoryPool: { poolName: 'Day Shift Sem 4 VTC' },
      },
    },
    include: {
      courseOffering: {
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              vtcTrackGroupCode: true,
              vtcTrackStage: true,
            },
          },
        },
      },
    },
  });
  console.log(`Sem-4 Day VTC pool sections: ${sections.length}`);

  const tracks = await prisma.studentVtcTrack.findMany({
    where: { tenantId },
    distinct: ['trackGroupCode'],
    select: { studentId: true, trackGroupCode: true },
    orderBy: { trackGroupCode: 'asc' },
  });

  let ok = 0;
  let bad = 0;
  for (const t of tracks) {
    const filtered = await svc.filterVtcSectionsSync(
      tenantId,
      t.studentId,
      4,
      sections as never[],
    );
    const codes = [
      ...new Set(
        (filtered as typeof sections).map((s) => s.courseOffering.course.code),
      ),
    ];
    const allStage2 = (filtered as typeof sections).every(
      (s) => s.courseOffering.course.vtcTrackStage === 2,
    );
    const pass = codes.length === 1 && allStage2;
    if (pass) ok++;
    else bad++;
    console.log(
      `${pass ? 'OK ' : 'XX '} ${t.trackGroupCode.padEnd(24)} -> ${codes.join(', ') || '(none)'}`,
    );
  }
  console.log(
    `\n${ok} groups continue to a single Stage-II course, ${bad} problem(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
