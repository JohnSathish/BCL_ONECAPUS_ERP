/**
 * Seed full FYUGP framework (8 semesters) + sync ERP course catalog into Knowledge Base.
 *
 *   npx tsx scripts/seed-knowledge-fyugp.ts
 *   npx tsx scripts/seed-knowledge-fyugp.ts --tenant=demo --sync-erp
 */
import { PrismaClient } from '@prisma/client';
import { KnowledgeIngestService } from '../src/modules/knowledge-base/knowledge-ingest.service';
import { KnowledgeQueryService } from '../src/modules/knowledge-base/knowledge-query.service';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const prisma = new PrismaClient();
const ingest = new KnowledgeIngestService(prisma as never);
const query = new KnowledgeQueryService(prisma as never);

async function main() {
  const tenantSlug = readArg('tenant') ?? 'demo';
  const syncErp = process.argv.includes('--sync-erp');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  console.log('Seeding FYUGP framework…');
  const seeded = await ingest.seedFyugpFramework(tenant.id);
  console.log(seeded);

  if (syncErp) {
    console.log('Syncing ERP course catalog…');
    const synced = await ingest.syncFromErpCatalog(tenant.id);
    console.log(synced);
  }

  const samples = [
    'Show Semester 3 course details',
    'Show Semester 5 course details',
    'What is SEC?',
    'Difference between SEC and MDC',
    'How many credits are required for FYUP?',
    'Total credits of Semester 5',
  ];
  for (const q of samples) {
    const a = await query.answer(tenant.id, q);
    console.log('\nQ:', q);
    console.log(a?.markdown?.slice(0, 300) ?? 'NO ANSWER');
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
