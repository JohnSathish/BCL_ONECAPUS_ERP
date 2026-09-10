import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const IMAGE = '/school-sis/explore/facilities-campus.jpg';

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura missing');
  const row = await prisma.schoolWebHomepageSection.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: 'explore' } },
  });
  if (!row) throw new Error('explore section missing');
  const payload = (
    row.payload &&
    typeof row.payload === 'object' &&
    !Array.isArray(row.payload)
      ? row.payload
      : {}
  ) as { cards?: Array<Record<string, unknown>> };
  const cards = (payload.cards ?? []).map((card) => {
    const href = String(card.href || '');
    if (href.includes('facilit')) return { ...card, imageUrl: IMAGE };
    return card;
  });
  await prisma.schoolWebHomepageSection.update({
    where: { id: row.id },
    data: { payload: { ...payload, cards } },
  });
  console.log('Updated St. Luke’s facilities explore photo');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
