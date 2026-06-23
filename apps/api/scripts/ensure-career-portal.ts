/**
 * Ensure careers portal tenant domains and default branding extras exist.
 *
 *   npx tsx scripts/ensure-career-portal.ts
 *   npx tsx scripts/ensure-career-portal.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';

const CAREER_HOSTS = ['career.demo.localhost', 'career.donboscocollege.ac.in'];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  for (const host of CAREER_HOSTS) {
    await prisma.tenantDomain.upsert({
      where: { host },
      update: { tenantId: tenant.id, verified: true, deletedAt: null },
      create: { tenantId: tenant.id, host, verified: true },
    });
    console.log(`✓ Domain registered: ${host}`);
  }

  const branding = await prisma.tenantBranding.findUnique({
    where: { tenantId: tenant.id },
  });
  const extras =
    branding?.portalExtrasJson && typeof branding.portalExtrasJson === 'object'
      ? (branding.portalExtrasJson as Record<string, unknown>)
      : {};

  const careersPortal = {
    ...(typeof extras.careersPortal === 'object' && extras.careersPortal
      ? extras.careersPortal
      : {}),
    principalName: 'Rev. Fr. Principal',
    principalTitle: 'Principal, Don Bosco College Tura',
    principalMessage:
      'We welcome passionate educators committed to academic excellence, research, and the holistic development of our students. Join us in shaping the future of Northeast India.',
  };

  await prisma.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    update: {
      portalExtrasJson: { ...extras, careersPortal },
    },
    create: {
      tenantId: tenant.id,
      displayName: 'Don Bosco College Tura',
      portalSubtitle: 'Campus ERP Portal',
      portalExtrasJson: { careersPortal },
    },
  });

  const published = await prisma.recruitmentVacancy.count({
    where: { tenantId: tenant.id, status: 'PUBLISHED' },
  });

  console.log(`✓ Careers portal extras configured for tenant "${tenantSlug}"`);
  console.log(`  Published vacancies: ${published}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
