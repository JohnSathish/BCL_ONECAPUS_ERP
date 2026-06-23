/**
 * Apply Don Bosco College Tura branding to an existing tenant (no full re-seed).
 *
 *   npx tsx scripts/apply-dbc-branding.ts
 *   npx tsx scripts/apply-dbc-branding.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { name: 'Don Bosco College Tura' },
  });

  await prisma.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    update: {
      displayName: 'Don Bosco College Tura',
      shortName: 'DBC Tura',
      campusName: 'Tura, Meghalaya',
      portalSubtitle: 'FYUGP - AY 2026-27 - ODD Semester',
      address: 'Tura, West Garo Hills, Meghalaya',
      badges: ['Affiliated to NEHU', 'NEP 2020', 'FYUGP'],
      primaryColor: '#1e3a5f',
      accentColor: '#c8102e',
      sidebarColor: '#152a45',
      loginBackgroundStyle: 'gradient',
      brandingEnabled: true,
      portalExtrasJson: {
        careersPortal: {
          principalName: 'Rev. Fr. Principal',
          principalTitle: 'Principal, Don Bosco College Tura',
          principalMessage:
            'We welcome passionate educators committed to academic excellence, research, and the holistic development of our students. Join us in shaping the future of Northeast India.',
        },
      },
    },
    create: {
      tenantId: tenant.id,
      displayName: 'Don Bosco College Tura',
      shortName: 'DBC Tura',
      campusName: 'Tura, Meghalaya',
      portalSubtitle: 'FYUGP - AY 2026-27 - ODD Semester',
      address: 'Tura, West Garo Hills, Meghalaya',
      badges: ['Affiliated to NEHU', 'NEP 2020', 'FYUGP'],
      primaryColor: '#1e3a5f',
      accentColor: '#c8102e',
      sidebarColor: '#152a45',
      loginBackgroundStyle: 'gradient',
      brandingEnabled: true,
      portalExtrasJson: {
        careersPortal: {
          principalName: 'Rev. Fr. Principal',
          principalTitle: 'Principal, Don Bosco College Tura',
          principalMessage:
            'We welcome passionate educators committed to academic excellence, research, and the holistic development of our students. Join us in shaping the future of Northeast India.',
        },
      },
    },
  });

  console.log(
    `Applied Don Bosco branding to tenant "${tenantSlug}" (${tenant.id})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
