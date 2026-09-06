/**
 * Remove Tura Public School demo K.G. applications and reset TPS27 numbering.
 *
 * School tenant only — never college FYUP admissions.
 *
 * Usage (API container / apps/api):
 *   npx tsx scripts/purge-school-demo-applicants.ts
 *   npx tsx scripts/purge-school-demo-applicants.ts --confirm
 *   npx tsx scripts/purge-school-demo-applicants.ts --confirm --application-numbers TPS27-0001,TPS27-0002
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SCHOOL_TENANT_SLUG = 'tura-public-school';
const DEFAULT_NUMBERS = ['TPS27-0001', 'TPS27-0002'];

type Options = {
  confirm: boolean;
  applicationNumbers: string[];
};

function parseArgs(argv: string[]): Options {
  const opts: Options = { confirm: false, applicationNumbers: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--confirm') opts.confirm = true;
    else if (arg === '--application-numbers' && argv[i + 1]) {
      opts.applicationNumbers = argv[i + 1]!.split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      i += 1;
    }
  }
  if (opts.applicationNumbers.length === 0) {
    opts.applicationNumbers = [...DEFAULT_NUMBERS];
  }
  return opts;
}

function nextSeqFromRemaining(numbers: string[]): number {
  let max = 0;
  for (const raw of numbers) {
    const match = raw.toUpperCase().match(/^TPS27-(\d+)$/);
    if (!match) continue;
    const n = Number.parseInt(match[1]!, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tenant = await prisma.tenant.findFirst({
    where: { slug: SCHOOL_TENANT_SLUG, deletedAt: null },
  });
  if (!tenant) {
    throw new Error(`Tenant "${SCHOOL_TENANT_SLUG}" not found.`);
  }

  const wanted = new Set(opts.applicationNumbers);

  console.log(
    `\nSchool demo applicant purge — tenant: ${tenant.name} (${tenant.slug})`,
  );
  console.log(
    opts.confirm
      ? 'Mode: APPLY (hard-delete applications, free TPS27 numbers)\n'
      : 'Mode: DRY RUN (preview only)\n',
  );
  console.log(`Target numbers: ${[...wanted].join(', ')}`);

  const apps = await prisma.admissionApplication.findMany({
    where: {
      tenantId: tenant.id,
      applicationNumber: { in: [...wanted] },
    },
    select: {
      id: true,
      cycleId: true,
      applicationNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      applicantUserId: true,
      deletedAt: true,
    },
    orderBy: { applicationNumber: 'asc' },
  });

  const missing = [...wanted].filter(
    (n) =>
      !apps.some((a) => a.applicationNumber.toUpperCase() === n.toUpperCase()),
  );

  console.log('\nApplications to remove:');
  if (apps.length === 0) console.log('  (none found)');
  for (const app of apps) {
    console.log(
      `  - ${app.applicationNumber} · ${app.firstName} ${app.lastName} · ${app.email} · ${app.status}${app.deletedAt ? ' (soft-deleted)' : ''}`,
    );
  }
  if (missing.length) {
    console.log(`\nNot found (already gone): ${missing.join(', ')}`);
  }

  const userIds = [
    ...new Set(
      apps
        .map((a) => a.applicantUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, tenantId: tenant.id },
        select: { id: true, email: true, username: true, displayName: true },
      })
    : [];

  console.log('\nLinked applicant logins:');
  if (!users.length) console.log('  (none)');
  for (const user of users) {
    console.log(
      `  - ${user.username} · ${user.email}${user.displayName ? ` (${user.displayName})` : ''}`,
    );
  }

  const cycleIds = [
    ...new Set(
      apps.map((a) => a.cycleId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const kgCycle =
    cycleIds.length === 1
      ? await prisma.admissionCycle.findFirst({
          where: { id: cycleIds[0], tenantId: tenant.id },
        })
      : await prisma.admissionCycle.findFirst({
          where: {
            tenantId: tenant.id,
            deletedAt: null,
            OR: [
              { code: { contains: 'KG', mode: 'insensitive' } },
              { title: { contains: 'K.G', mode: 'insensitive' } },
            ],
          },
          orderBy: { createdAt: 'desc' },
        });

  if (!kgCycle) {
    throw new Error(
      'K.G. 2027 admission cycle not found for Tura Public School.',
    );
  }

  console.log(
    `\nCycle: ${kgCycle.code} · ${kgCycle.title} · applicationSeq=${kgCycle.applicationSeq}`,
  );

  if (!opts.confirm) {
    console.log('\nDry run only. Re-run with --confirm to apply.');
    return;
  }

  const appIds = apps.map((a) => a.id);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (appIds.length > 0) {
      await tx.student.updateMany({
        where: {
          tenantId: tenant.id,
          admissionApplicationId: { in: appIds },
        },
        data: { admissionApplicationId: null },
      });

      await tx.frontOfficeEnquiry.updateMany({
        where: {
          tenantId: tenant.id,
          admissionApplicationId: { in: appIds },
        },
        data: { admissionApplicationId: null },
      });

      await tx.admissionApplication.deleteMany({
        where: { id: { in: appIds }, tenantId: tenant.id },
      });
    }

    for (const user of users) {
      const token = user.id.replace(/-/g, '').slice(0, 12);
      await tx.userRole.updateMany({
        where: { userId: user.id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          deletedAt: now,
          isActive: false,
          accountStatus: 'inactive',
          username: `purged.${token}`,
          email: `purged.${token}@purged.local`,
        },
      });
    }

    const remaining = await tx.admissionApplication.findMany({
      where: { tenantId: tenant.id, cycleId: kgCycle.id },
      select: { applicationNumber: true },
    });
    const resetTo = nextSeqFromRemaining(
      remaining.map((row) => row.applicationNumber),
    );
    await tx.admissionCycle.update({
      where: { id: kgCycle.id },
      data: { applicationSeq: resetTo },
    });
    console.log(
      `\napplicationSeq reset to ${resetTo} (next number TPS27-${String(resetTo + 1).padStart(4, '0')})`,
    );
  });

  console.log('\nDone.');
  console.log(`  applications hard-deleted: ${apps.length}`);
  console.log(`  applicant logins freed: ${users.length}`);
  console.log('  Refresh School ERP → Admission 2027 → K.G. Applications.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
