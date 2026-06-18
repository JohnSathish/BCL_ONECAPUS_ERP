import { createHash, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const existing = await prisma.accessPoint.findFirst({
    where: { tenantId: tenant.id, code: 'library', deletedAt: null },
  });
  if (existing) {
    console.log('Access point already exists:', existing.code);
    return;
  }

  const token = randomBytes(24).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  const point = await prisma.accessPoint.create({
    data: {
      tenantId: tenant.id,
      code: 'library',
      name: 'Library Entry Gate',
      accessType: 'LIBRARY',
      location: 'Main Library Entrance',
    },
  });
  await prisma.accessKioskDevice.create({
    data: {
      tenantId: tenant.id,
      accessPointId: point.id,
      name: 'Library Scanner 1',
      tokenHash: hash,
      tokenPrefix: token.slice(0, 8),
    },
  });
  console.log(`Kiosk URL: http://localhost:3000/kiosk/library?token=${token}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
