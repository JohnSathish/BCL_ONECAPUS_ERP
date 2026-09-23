/**
 * Clear student/staff in-app notification inbox rows before an official app launch.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/purge-test-user-notifications.ts --tenant=demo --dry-run
 *   npx tsx scripts/purge-test-user-notifications.ts --tenant=demo --execute
 *
 * Deletes platform.notifications (UserNotification) for the tenant.
 * Does not remove campaigns, templates, preferences, or push delivery code.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const tenantSlug = arg('tenant') ?? 'demo';
  const execute = hasFlag('execute');
  const dryRun = !execute;

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: tenantSlug },
        { slug: { contains: 'don-bosco', mode: 'insensitive' } },
        { slug: { contains: 'donbosco', mode: 'insensitive' } },
      ],
    },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    throw new Error(`Tenant not found for slug/filter: ${tenantSlug}`);
  }

  const count = await prisma.userNotification.count({
    where: { tenantId: tenant.id },
  });

  console.log(
    JSON.stringify(
      {
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
        inboxRows: count,
        mode: dryRun ? 'dry-run' : 'execute',
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log('Dry run only. Re-run with --execute to delete inbox rows.');
    return;
  }

  const deleted = await prisma.userNotification.deleteMany({
    where: { tenantId: tenant.id },
  });

  console.log(
    `Deleted ${deleted.count} user notification(s) for tenant ${tenant.slug}.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
