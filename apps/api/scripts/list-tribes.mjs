import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const tenant =
  (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
  (await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  }));
if (!tenant) throw new Error('tenant not found');
const tribes = await prisma.masterLookup.findMany({
  where: { tenantId: tenant.id, lookupType: 'TRIBE', isActive: true },
  select: { label: true, code: true },
  orderBy: { label: 'asc' },
});
for (const tribe of tribes) console.log(tribe.label);
await prisma.$disconnect();
