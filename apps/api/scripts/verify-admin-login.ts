/**
 * Verify admin email/password against the database (bypasses HTTP).
 * Usage:
 *   VERIFY_EMAIL=admin@donboscocollege.ac.in VERIFY_PASSWORD='...' npx tsx scripts/verify-admin-login.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.VERIFY_EMAIL?.trim().toLowerCase();
  const password = process.env.VERIFY_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('Set VERIFY_EMAIL and VERIFY_PASSWORD');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo', deletedAt: null },
  });
  if (!tenant) {
    throw new Error('Tenant "demo" not found — run db:seed');
  }
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  const domain = await prisma.tenantDomain.findFirst({
    where: { host: 'erp.donboscocollege.ac.in', deletedAt: null },
  });
  console.log(
    domain
      ? `Domain erp.donboscocollege.ac.in -> tenant ${domain.tenantId} verified=${domain.verified}`
      : 'Domain erp.donboscocollege.ac.in NOT REGISTERED',
  );

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email, deletedAt: null },
    include: {
      roles: {
        where: { deletedAt: null },
        include: { role: { select: { slug: true } } },
      },
    },
  });

  if (!user) {
    const similar = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { email: { contains: 'donboscocollege', mode: 'insensitive' } },
          { email: { contains: 'admin', mode: 'insensitive' } },
        ],
      },
      select: { email: true, isActive: true },
      take: 10,
    });
    console.error(`User not found: ${email}`);
    console.log('Admin-like users in tenant:', similar);
    process.exit(1);
  }

  console.log(`User: ${user.email} active=${user.isActive}`);
  console.log(
    `Roles: ${user.roles.map((r) => r.role.slug).join(', ') || '(none)'}`,
  );

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  console.log(`Password matches hash: ${passwordOk ? 'YES' : 'NO'}`);

  if (!passwordOk) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
