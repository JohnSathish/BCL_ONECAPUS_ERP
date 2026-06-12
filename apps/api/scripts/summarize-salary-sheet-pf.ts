import ExcelJS from 'exceljs';

const SOURCE = 'E:/Projects/1505NEWERP/Staff SALARY-.xlsx';

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').toUpperCase();
}

function parseNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'object' && v && 'result' in v)
    return parseNum((v as { result: unknown }).result);
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
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SOURCE);
  const sheet = wb.worksheets[0];

  let headerRow = 0;
  sheet.eachRow((row, rowNumber) => {
    if (cellStr(row.getCell(3).value).toUpperCase() === 'NAME')
      headerRow = rowNumber;
  });

  const rows: Array<{
    name: string;
    basic: number;
    pfEmployer: number;
    gross: number;
    ppf: number;
    net: number;
    pfExempt: boolean;
  }> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const name = cellStr(row.getCell(3).value);
    if (!name || name.toUpperCase().startsWith('TOTAL')) return;
    const basic = parseNum(row.getCell(4).value);
    const pfEmployer = parseNum(row.getCell(5).value);
    const gross = parseNum(row.getCell(6).value);
    const ppf = parseNum(row.getCell(7).value);
    const net = parseNum(row.getCell(10).value);
    rows.push({
      name,
      basic,
      pfEmployer,
      gross,
      ppf,
      net,
      pfExempt: pfEmployer <= 0,
    });
  });

  const enrolled = rows.filter((r) => !r.pfExempt);
  const exempt = rows.filter((r) => r.pfExempt);

  console.log(
    'Salary sheet (Teaching College Management — May 2026 reference)',
  );
  console.log(`Total staff: ${rows.length}`);
  console.log(`PF enrolled: ${enrolled.length}`);
  console.log(`PF exempt:   ${exempt.length}`);
  console.log('');
  console.log('Enrolled totals:');
  console.log(
    `  Basic sum:        ₹${enrolled.reduce((s, r) => s + r.basic, 0).toLocaleString('en-IN')}`,
  );
  console.log(
    `  Employer PF sum:  ₹${enrolled.reduce((s, r) => s + r.pfEmployer, 0).toLocaleString('en-IN')}`,
  );
  console.log(
    `  PPF sum:          ₹${enrolled.reduce((s, r) => s + r.ppf, 0).toLocaleString('en-IN')}`,
  );
  console.log(
    `  Gross sum:        ₹${enrolled.reduce((s, r) => s + r.gross, 0).toLocaleString('en-IN')}`,
  );
  console.log(
    `  Net sum:          ₹${enrolled.reduce((s, r) => s + r.net, 0).toLocaleString('en-IN')}`,
  );
  console.log('');
  console.log('Exempt staff:');
  for (const r of exempt.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(
      `  ${r.name.trim()} — Basic ₹${r.basic.toLocaleString('en-IN')}, Net ₹${r.net.toLocaleString('en-IN')}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
