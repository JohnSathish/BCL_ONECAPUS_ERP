/**
 * Diagnose why FYUGP pool category dropdowns are empty.
 * Run: npx ts-node --transpile-only scripts/diagnose-fyugp-catalog.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) {
    console.error('Demo tenant not found');
    process.exit(1);
  }

  const version = await prisma.programVersion.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      program: {
        OR: [
          { code: { contains: 'BA-ECO', mode: 'insensitive' } },
          { name: { contains: 'Economics', mode: 'insensitive' } },
        ],
      },
    },
    include: { program: { select: { code: true, name: true } } },
    orderBy: { version: 'desc' },
  });

  if (!version) {
    console.error('BA-ECO program version not found');
    process.exit(1);
  }

  console.log('\n=== FYUGP Catalog Diagnostic ===\n');
  console.log(
    'Program version:',
    version.program.code,
    `v${version.version}`,
    version.id,
  );

  const semesterSequence = 1;
  const assignments = await prisma.programmePoolAssignment.findMany({
    where: {
      tenantId: tenant.id,
      programVersionId: version.id,
      semesterNo: semesterSequence,
      active: true,
      pool: { active: true },
    },
    include: {
      pool: {
        select: { poolName: true, categoryType: true, semesterNo: true },
      },
    },
  });

  console.log('\n--- Pool assignments (Sem 1) ---');
  if (!assignments.length) {
    console.log('NONE — pools are not assigned to this programme for Sem 1');
  } else {
    for (const a of assignments) {
      console.log(`  ${a.pool.categoryType}: ${a.pool.poolName} (${a.poolId})`);
    }
  }

  const poolIds = assignments.map((a) => a.poolId);
  const poolOfferings = poolIds.length
    ? await prisma.courseOffering.findMany({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          mappingSource: 'SHARED_POOL',
          categoryPoolId: { in: poolIds },
          semesterSequence,
        },
        include: {
          course: { select: { code: true, title: true } },
          sections: {
            where: { deletedAt: null },
            include: {
              shift: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
      })
    : [];

  console.log('\n--- Pool offerings vs sections ---');
  const byCategory: Record<
    string,
    { offerings: number; withSections: number; sections: number }
  > = {};
  for (const o of poolOfferings) {
    const cat = (o.category ?? 'UNKNOWN').toUpperCase();
    byCategory[cat] ??= { offerings: 0, withSections: 0, sections: 0 };
    byCategory[cat].offerings++;
    const activeSections = o.sections.filter((s) => s.status === 'active');
    if (activeSections.length) byCategory[cat].withSections++;
    byCategory[cat].sections += activeSections.length;
  }

  for (const [cat, stats] of Object.entries(byCategory).sort()) {
    console.log(
      `  ${cat}: ${stats.offerings} offering(s), ${stats.withSections} with active section(s), ${stats.sections} total active section(s)`,
    );
  }

  const noSections = poolOfferings.filter(
    (o) => !o.sections.some((s) => s.status === 'active'),
  );
  if (noSections.length) {
    console.log(
      '\n--- Offerings WITHOUT active delivery sections (first 10) ---',
    );
    for (const o of noSections.slice(0, 10)) {
      console.log(
        `  ${o.category} ${o.course.code} — ${o.course.title} (offering ${o.id})`,
      );
    }
    if (noSections.length > 10) {
      console.log(`  ... and ${noSections.length - 10} more`);
    }
  }

  const shifts = await prisma.shift.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, code: true, name: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('\n--- Academic shifts ---');
  for (const s of shifts) {
    console.log(`  ${s.code}: ${s.name} (${s.id})`);
  }

  for (const shift of shifts) {
    const catalogCount = await prisma.offeringSection.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: 'active',
        shiftId: shift.id,
        courseOffering: {
          deletedAt: null,
          OR: [
            {
              programVersionId: version.id,
              semesterSequence,
              OR: [{ mappingSource: 'DIRECT' }, { categoryPoolId: null }],
            },
            {
              mappingSource: 'SHARED_POOL',
              categoryPoolId: poolIds.length ? { in: poolIds } : { in: [] },
              semesterSequence,
            },
          ],
        },
      },
    });

    const poolOnly = await prisma.offeringSection.groupBy({
      by: ['courseOfferingId'],
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: 'active',
        shiftId: shift.id,
        courseOffering: {
          deletedAt: null,
          mappingSource: 'SHARED_POOL',
          categoryPoolId: poolIds.length ? { in: poolIds } : { in: [] },
          semesterSequence,
        },
      },
    });

    console.log(
      `\n  Catalog sections for shift "${shift.code}": ${catalogCount} total (${poolOnly.length} pool offerings with ≥1 section)`,
    );
  }

  const mdcPool = assignments.find((a) => a.pool.categoryType === 'MDC');
  if (mdcPool) {
    const sample = await prisma.courseOffering.findFirst({
      where: {
        tenantId: tenant.id,
        categoryPoolId: mdcPool.poolId,
        deletedAt: null,
        course: { code: { startsWith: 'MDC' } },
      },
      include: {
        course: { select: { code: true } },
        sections: {
          where: { deletedAt: null },
          select: { id: true, sectionCode: true, status: true, shiftId: true },
        },
      },
    });
    if (sample) {
      console.log('\n--- Sample MDC offering section detail ---');
      console.log(`  Course: ${sample.course.code}, offering: ${sample.id}`);
      console.log(
        `  Sections: ${sample.sections.length ? JSON.stringify(sample.sections, null, 2) : 'NONE'}`,
      );
    }
  }

  console.log('\n=== Diagnosis ===');
  const poolCats = ['MDC', 'AEC', 'SEC', 'VAC'];
  for (const cat of poolCats) {
    const stats = byCategory[cat];
    if (!stats) {
      console.log(
        `  ${cat}: no pool offerings resolved (check pool assignment or pool courses)`,
      );
    } else if (stats.sections === 0) {
      console.log(
        `  ${cat}: curriculum mapped (${stats.offerings} courses) but NO delivery sections — dropdown will be empty`,
      );
    } else {
      console.log(
        `  ${cat}: OK — ${stats.sections} active section(s) available`,
      );
    }
  }

  for (const cat of ['MAJOR', 'MINOR'] as const) {
    const count = await prisma.offeringSection.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: 'active',
        courseOffering: {
          programVersionId: version.id,
          category: cat,
          semesterSequence,
          deletedAt: null,
        },
      },
    });
    console.log(
      `  ${cat}: ${count} active section(s) on programme-specific offerings`,
    );
  }

  const dayShift = shifts.find((s) => s.code === 'DAY');
  if (dayShift) {
    const dayRows = await prisma.offeringSection.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        status: 'active',
        shiftId: dayShift.id,
        courseOffering: { semesterSequence, deletedAt: null },
      },
      include: {
        courseOffering: { include: { course: { select: { code: true } } } },
      },
      take: 20,
    });
    console.log('\n--- Sample DAY shift sections (Sem 1 offerings) ---');
    for (const row of dayRows) {
      console.log(
        `  ${row.courseOffering.category} ${row.courseOffering.course.code} (${row.courseOffering.mappingSource ?? 'DIRECT'})`,
      );
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
