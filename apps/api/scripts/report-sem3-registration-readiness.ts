/**
 * READ-ONLY readiness report for draft Semester-3 registrations.
 *
 * Runs the ENGINE'S OWN validators (AcademicEngineService.validateRegistration)
 * against every draft Sem-3 registration and reports how many would finalize
 * cleanly vs which are blocked and why. Writes NOTHING.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/report-sem3-registration-readiness.ts
 *   npx ts-node -r tsconfig-paths/register scripts/report-sem3-registration-readiness.ts --tenant=demo --sem=3
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AcademicEngineService } from '../src/modules/academic-engine/academic-engine.service';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const sem = Number(readArg('sem') ?? '3');
const onlyEnrollment = readArg('enrollment');

async function main() {
  const prisma = new PrismaClient();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const engine = app.get(AcademicEngineService);

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);
  const tenantId = tenant.id;

  const regs = await prisma.semesterRegistration.findMany({
    where: {
      tenantId,
      semesterSequence: sem,
      status: 'draft',
      ...(onlyEnrollment
        ? { student: { enrollmentNumber: onlyEnrollment } }
        : {}),
    },
    select: {
      id: true,
      student: { select: { enrollmentNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    `\nSem-${sem} draft registrations for ${tenant.slug}: ${regs.length}\n`,
  );

  let okCount = 0;
  let blockedCount = 0;
  let erroredCount = 0;
  const blockingCodes: Record<string, number> = {};
  const warningCodes: Record<string, number> = {};
  const errorMessages: Record<string, number> = {};
  const blockedSamples: { enrollment: string; codes: string[] }[] = [];

  let processed = 0;
  for (const reg of regs) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`  …validated ${processed}/${regs.length}`);
    }
    const enrollment = reg.student?.enrollmentNumber ?? reg.id.slice(0, 8);
    try {
      const result = await engine.validateRegistration(tenantId, reg.id);
      const blocking = result.issues.filter((i) => i.severity !== 'warning');
      for (const w of result.issues.filter((i) => i.severity === 'warning')) {
        warningCodes[w.code] = (warningCodes[w.code] ?? 0) + 1;
      }
      if (result.ok) {
        okCount++;
      } else {
        blockedCount++;
        for (const b of blocking) {
          blockingCodes[b.code] = (blockingCodes[b.code] ?? 0) + 1;
        }
        if (blockedSamples.length < 25) {
          blockedSamples.push({
            enrollment,
            codes: [...new Set(blocking.map((b) => b.code))],
          });
        }
      }
    } catch (err) {
      erroredCount++;
      const full = err instanceof Error ? err.message : String(err);
      const msg = full.slice(0, 80);
      errorMessages[msg] = (errorMessages[msg] ?? 0) + 1;
      if (blockedSamples.length < 25) {
        blockedSamples.push({ enrollment, codes: [`ERROR: ${msg}`] });
      }
      if (onlyEnrollment) {
        console.log(`\n----- FULL ERROR for ${enrollment} -----`);
        console.log(full);
        console.log('----- END FULL ERROR -----\n');
      }
    }
  }

  const sortEntries = (o: Record<string, number>) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]);

  console.log('\n========== READINESS SUMMARY ==========');
  console.log(`Total draft:              ${regs.length}`);
  console.log(`Would finalize cleanly:   ${okCount}`);
  console.log(`Blocked by validation:    ${blockedCount}`);
  console.log(`Threw during validation:  ${erroredCount}`);

  console.log('\nBlocking issue codes (student count):');
  for (const [code, n] of sortEntries(blockingCodes)) {
    console.log(`  ${String(n).padStart(4)}  ${code}`);
  }
  if (Object.keys(errorMessages).length) {
    console.log('\nValidation errors thrown:');
    for (const [msg, n] of sortEntries(errorMessages)) {
      console.log(`  ${String(n).padStart(4)}  ${msg}`);
    }
  }
  if (Object.keys(warningCodes).length) {
    console.log('\nWarnings (non-blocking):');
    for (const [code, n] of sortEntries(warningCodes)) {
      console.log(`  ${String(n).padStart(4)}  ${code}`);
    }
  }
  console.log('\nSample blocked students:');
  for (const s of blockedSamples) {
    console.log(`  ${s.enrollment.padEnd(16)} ${s.codes.join(', ')}`);
  }
  console.log('\n(Read-only — no data was changed.)');

  await app.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
