/**
 * Ingest NEHU Curriculum & Credit Framework PDF into the institutional Knowledge Base.
 *
 * Usage:
 *   npx tsx scripts/ingest-nehu-curriculum.ts
 *   npx tsx scripts/ingest-nehu-curriculum.ts --tenant=demo --pdf="C:\path\to\file.pdf"
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { KnowledgeIngestService } from '../src/modules/knowledge-base/knowledge-ingest.service';
import { KnowledgeQueryService } from '../src/modules/knowledge-base/knowledge-query.service';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const DEFAULT_PDF =
  'C:\\Users\\johnm\\OneDrive\\Desktop\\Import Live 1-3-5\\NEHU CURRICULUM AND CREDIT FRAMEWORK FOR UNDERGRADUATE PROGRAMMES.pdf';

async function main() {
  const tenantSlug = readArg('tenant') ?? 'demo';
  const pdfPath = readArg('pdf') ?? DEFAULT_PDF;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const ingest = app.get(KnowledgeIngestService);
    const query = app.get(KnowledgeQueryService);

    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, deletedAt: null },
    });
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantSlug}`);
    }

    console.log(`Ingesting into tenant ${tenant.name} (${tenant.id})`);
    console.log(`PDF: ${pdfPath}`);

    const result = await ingest.ingestNehuCurriculumPdf(tenant.id, pdfPath);
    console.log('Ingest result:', result);

    const samples = [
      'What is the credit for MDC-110?',
      'Show Semester 1 course details',
      'How many credits are required for FYUP?',
      'Which MDC courses are available in Semester 1?',
      'Explain VAC-140',
      'Compare Semester 1 and Semester 2',
    ];

    for (const q of samples) {
      const answer = await query.answer(tenant.id, q);
      console.log('\nQ:', q);
      console.log(answer ? answer.markdown.slice(0, 400) : '(no answer)');
      if (answer?.table) {
        console.log(
          `Table: ${answer.table.columns.map((c) => c.label).join(' | ')} (${answer.table.rows.length} rows)`,
        );
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
