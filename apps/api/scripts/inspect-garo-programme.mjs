import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const rolls = ['BA25-104', 'BA25-035'];
for (const roll of rolls) {
  const s = await p.student.findFirst({
    where: { rollNumber: roll },
    select: {
      rollNumber: true,
      programVersion: {
        select: {
          id: true,
          version: true,
          program: { select: { code: true, name: true } },
        },
      },
      department: { select: { code: true, name: true } },
      programChoices: { select: { choiceType: true, subjectSlug: true } },
      semesterRegistrations: {
        where: { semesterSequence: 3 },
        select: {
          status: true,
          lines: {
            select: {
              category: true,
              offering: {
                select: {
                  course: { select: { code: true, title: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  console.log(`\n=== ${roll} ===`);
  console.log(JSON.stringify(s, null, 2));
}

const progs = await p.program.findMany({
  where: {
    OR: [
      { code: { contains: 'GAR', mode: 'insensitive' } },
      { code: { contains: 'GEO', mode: 'insensitive' } },
    ],
  },
  select: {
    id: true,
    code: true,
    name: true,
    department: { select: { code: true, name: true } },
    versions: {
      select: { id: true, version: true, status: true },
    },
  },
});
console.log('\n=== PROGRAMMES ===');
console.log(JSON.stringify(progs, null, 2));

const garVersions = await p.programVersion.findMany({
  where: { program: { code: 'BA-GAR' } },
  select: { id: true, version: true, status: true },
});
console.log('\n=== BA-GAR VERSIONS ===');
console.log(JSON.stringify(garVersions, null, 2));

const garMajor = await p.courseOffering.findMany({
  where: {
    programVersion: { program: { code: 'BA-GAR' } },
    category: 'MAJOR',
    semesterSequence: 3,
  },
  select: {
    id: true,
    category: true,
    course: { select: { code: true, title: true } },
  },
});
console.log('\n=== BA-GAR SEM3 MAJOR OFFERINGS ===');
console.log(JSON.stringify(garMajor, null, 2));

await p.$disconnect();
