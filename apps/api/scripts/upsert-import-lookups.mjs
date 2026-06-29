/**
 * Upsert master lookups needed for student bulk import.
 * Usage: node scripts/upsert-import-lookups.mjs [--tenant=demo]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LOOKUPS = [
  {
    lookupType: 'DENOMINATION',
    code: 'BAPTIST',
    label: 'Baptist',
    sortOrder: 1,
  },
  {
    lookupType: 'DENOMINATION',
    code: 'CATHOLIC',
    label: 'Catholic',
    sortOrder: 2,
  },
  {
    lookupType: 'DENOMINATION',
    code: 'CHRISTIAN',
    label: 'Christian',
    sortOrder: 3,
  },
  { lookupType: 'DENOMINATION', code: 'OTHER', label: 'Other', sortOrder: 4 },
  { lookupType: 'DENOMINATION', code: 'HINDU', label: 'Hindu', sortOrder: 5 },
  { lookupType: 'TRIBE', code: 'GARO', label: 'Garo', sortOrder: 1 },
  { lookupType: 'TRIBE', code: 'JAINTIA', label: 'Jaintia', sortOrder: 2 },
  { lookupType: 'TRIBE', code: 'KHASI', label: 'Khasi', sortOrder: 3 },
  { lookupType: 'TRIBE', code: 'BENGALI', label: 'Bengali', sortOrder: 4 },
  { lookupType: 'TRIBE', code: 'HAJONG', label: 'Hajong', sortOrder: 5 },
  { lookupType: 'TRIBE', code: 'NEPALI', label: 'Nepali', sortOrder: 6 },
  { lookupType: 'TRIBE', code: 'BIHARI', label: 'Bihari', sortOrder: 7 },
  { lookupType: 'TRIBE', code: 'ODIYA', label: 'Odiya', sortOrder: 8 },
  { lookupType: 'TRIBE', code: 'KOCH', label: 'Koch', sortOrder: 10 },
  { lookupType: 'TRIBE', code: 'TANGKHUL', label: 'Tangkhul', sortOrder: 11 },
  { lookupType: 'TRIBE', code: 'OTHER', label: 'Others', sortOrder: 9 },
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
