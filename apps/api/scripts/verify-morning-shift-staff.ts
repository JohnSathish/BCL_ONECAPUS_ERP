/**
 * Verify Morning Shift staff list against directory.
 * Run: npx ts-node --transpile-only scripts/verify-morning-shift-staff.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { normalizeStaffName } from '../src/modules/staff/services/staff-shift-category';

const NAMES = [
  'CHONRE CH MARAK',
  'BRITHUEL G SANGMA',
  'CHANCHIAMAN R MARAK',
  'ALBERT S TIRKEY',
  'NOKME M MARAK',
  'RUBITHA A SANGMA',
  'BENOBITHA M SANGMA',
  'UZZIEL S MOMIN',
  'THOMAS M MARAK',
  'KASAAN CHOKCHIM M SANGMA',
  'AKSANA NEHA CH MARAK',
  'CHICHI CH SANGMA',
  'RINGSE RANI PATRINGCHI K MARAK',
  'GRIPSENG G MOMIN',
  'BINDARASH R MARAK',
  'KSANBOR KHARKONGOR',
  'ALWISHA T SANGMA',
  'CHARE N SANGMA',
  'AMBALIKA D SANGMA',
  'SUZAN MARYL S MARAK',
  'MARCUCH SANGMA',
  'FRIANGKY M MARAK',
  'SONATCHI T SANGMA',
  'ISSAC WASA',
  'NIKJRANG A SANGMA',
  'JESTERFIELD D SANGMA',
  'SALMAN',
  'JUDALIN KHARSHANDI',
  'TUSUMIKA ADHIKARI',
  'RENCHI CH SANGMA',
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const tenant = await prisma.tenant.findFirst({
    where: { name: { contains: 'Don Bosco' } },
  });
  const staff = await prisma.staffProfile.findMany({
    where: { tenantId: tenant!.id, deletedAt: null, staffType: 'TEACHING' },
    select: {
      employeeCode: true,
      fullName: true,
      teachingShiftCategory: true,
      department: { select: { name: true } },
    },
  });
  const byName = new Map(staff.map((s) => [normalizeStaffName(s.fullName), s]));

  for (const name of NAMES) {
    const key = normalizeStaffName(name);
    const exact = byName.get(key);
    if (exact) {
      console.log(
        `OK  ${name} → ${exact.employeeCode} | ${exact.fullName} | ${exact.teachingShiftCategory}`,
      );
      continue;
    }
    const partial = staff.filter((s) => {
      const tokens = key.split(' ').filter((t) => t.length > 2);
      const st = normalizeStaffName(s.fullName);
      return tokens.every((t) => st.includes(t));
    });
    if (partial.length === 1) {
      const p = partial[0];
      console.log(
        `~   ${name} → ${p.employeeCode} | ${p.fullName} | ${p.teachingShiftCategory}`,
      );
    } else if (partial.length > 1) {
      console.log(
        `??  ${name} → multiple: ${partial.map((p) => p.fullName).join('; ')}`,
      );
    } else {
      console.log(`MISS ${name}`);
    }
  }
  await app.close();
}

main();
