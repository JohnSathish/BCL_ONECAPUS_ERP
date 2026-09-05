/**
 * Ensure Tura Public School tenant, domains, and KG 2027 cycle exist.
 *
 *   npx tsx scripts/ensure-tps-school.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedTuraPublicSchool } from '../prisma/seeds/seed-tura-public-school';

const prisma = new PrismaClient();

async function main() {
  const result = await seedTuraPublicSchool(prisma);
  console.log('✓ Tura Public School tenant ready');
  console.log(`  Admin: ${result.adminEmail} / Admin@123`);
  console.log(
    '  Portal: http://admission.tps.localhost:3000 (hosts file → 127.0.0.1)',
  );
  console.log('  Office: http://tps.localhost:3000/login');
  console.log('  Production portal: https://admission.turapublicschool.com/');
  console.log('  Production ERP:    https://erp.turapublicschool.com/login');
  for (const host of result.hosts) {
    console.log(`  Domain: ${host}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
