import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const studentId = 'cac1a665-97a6-443b-be9e-12c692cc590d';
  const reg = await prisma.semesterRegistration.findFirst({
    where: { studentId },
    include: {
      lines: {
        include: {
          offering: { include: { course: true } },
          offeringSection: { include: { shift: true } },
        },
      },
      semester: true,
    },
  });
  if (!reg) {
    console.log('No registration for deleted student');
    return;
  }
  console.log(
    'Registration:',
    reg.id,
    'status:',
    reg.status,
    'sem:',
    reg.semesterSequence,
  );
  let credits = 0;
  for (const line of reg.lines) {
    const code = line.offering?.course?.code;
    const cat = line.category;
    const cred = Number(line.offering?.course?.credits ?? line.credits ?? 0);
    credits += cred;
    console.log(
      `  ${cat} ${code} credits=${cred} section=${line.offeringSection?.sectionCode} shift=${line.offeringSection?.shift?.code}`,
    );
  }
  console.log('Total credits:', credits);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
