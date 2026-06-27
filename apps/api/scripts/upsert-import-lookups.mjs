/**
 * Upsert master lookups needed for student bulk import.
 * Usage: node scripts/upsert-import-lookups.mjs [--tenant=demo]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LOOKUPS = [
  {
    lookupType: 'DENOMINATION',
    code: 'CATHOLIC',
    label: 'Catholic',
    sortOrder: 2,
  },
  { lookupType: 'DENOMINATION', code: 'OTHER', label: 'Other', sortOrder: 4 },
  { lookupType: 'DENOMINATION', code: 'HINDU', label: 'Hindu', sortOrder: 5 },
  { lookupType: 'RELIGION', code: 'BUDDHIST', label: 'Buddhist', sortOrder: 5 },
];

function readArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const tenantSlug = readArg('tenant') ?? process.env.TENANT_SLUG ?? 'demo';
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" not found.`);
    process.exit(1);
  }

  for (const lookup of LOOKUPS) {
    const row = await prisma.masterLookup.upsert({
      where: {
        tenantId_lookupType_code: {
          tenantId: tenant.id,
          lookupType: lookup.lookupType,
          code: lookup.code,
        },
      },
      create: { tenantId: tenant.id, ...lookup, isActive: true },
      update: {
        label: lookup.label,
        sortOrder: lookup.sortOrder,
        isActive: true,
        archivedAt: null,
      },
    });
    console.log(`Upserted ${row.lookupType} / ${row.code} (${row.label})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
