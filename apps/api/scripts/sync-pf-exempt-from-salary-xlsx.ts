import { NestFactory } from '@nestjs/core';
import ExcelJS from 'exceljs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { mergeStatutoryOverrides } from '../src/modules/payroll/services/pay-statutory-overrides';

const SOURCE = 'E:/Projects/1505NEWERP/Staff SALARY-.xlsx';

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').toUpperCase();
}

function parseNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && 'result' in (v as object))
    return String((v as { result: unknown }).result ?? '').trim();
  return String(v).trim();
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error'],
  });
  const prisma = app.get(PrismaService);

  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SOURCE);
  const sheet = wb.worksheets[0];

  const pfByName = new Map<string, { pfExempt: boolean; houseRent: number }>();
  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    if (cellStr(row.getCell(3).value).toUpperCase() === 'NAME')
      headerRow = rowNumber;
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const name = cellStr(row.getCell(3).value);
    if (!name || name.toUpperCase().startsWith('TOTAL')) return;
    const pfEmployer = parseNum(row.getCell(5).value);
    const houseRent = parseNum(row.getCell(8).value);
    pfByName.set(normalizeName(name), { pfExempt: pfEmployer <= 0, houseRent });
  });

  const assignments = await prisma.staffPayAssignment.findMany({
    where: {
      tenantId: tenant.id,
      status: 'ACTIVE',
      payScaleType: 'COLLEGE_TEACHING',
    },
    include: { staffProfile: { select: { fullName: true } } },
  });

  let updated = 0;
  for (const a of assignments) {
    const key = normalizeName(a.staffProfile.fullName);
    const row = pfByName.get(key);
    if (!row) continue;

    const overrides = mergeStatutoryOverrides(
      a.componentOverrides as Record<string, unknown>,
      {
        pfExempt: row.pfExempt,
        houseRent: row.houseRent,
      },
    );

    await prisma.staffPayAssignment.update({
      where: { id: a.id },
      data: { componentOverrides: overrides ?? undefined },
    });
    updated += 1;
    if (row.pfExempt) console.log('PF exempt:', a.staffProfile.fullName);
  }

  console.log('Updated assignments:', updated);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
