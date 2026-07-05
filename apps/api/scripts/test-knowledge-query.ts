import { PrismaClient } from '@prisma/client';
import { KnowledgeQueryService } from '../src/modules/knowledge-base/knowledge-query.service';

const prisma = new PrismaClient();
const query = new KnowledgeQueryService(prisma as never);

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant missing');

  const questions = [
    'What is the credit for MDC-110?',
    'Show Semester 1 course details',
    'How many credits are required for FYUP?',
    'Which MDC courses are available in Semester 1?',
    'Explain Semester 1',
    'Explain VAC-140',
    'Compare Semester 1 and Semester 2',
    'List all AEC courses',
  ];

  for (const question of questions) {
    const answer = await query.answer(tenant.id, question);
    console.log('\n===', question);
    console.log(answer?.markdown ?? 'NO ANSWER');
    if (answer?.table) {
      console.log(
        'TABLE:',
        answer.table.columns.map((c) => c.label).join(' | '),
      );
      console.log(JSON.stringify(answer.table.rows, null, 0));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
