import ExcelJS from 'exceljs';

const filePath = 'E:/Projects/1505NEWERP/Staff SALARY-.xlsx';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log(
    'Worksheets:',
    wb.worksheets.map((s) => s.name),
  );
  for (const sheet of wb.worksheets) {
    console.log('\n=== SHEET:', sheet.name, '===');
    let count = 0;
    sheet.eachRow((row, rowNumber) => {
      if (count >= 30) return;
      const vals: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        if (col <= 15) {
          const v = cell.value;
          vals[col - 1] =
            typeof v === 'object' && v && 'result' in v
              ? String((v as { result: unknown }).result)
              : String(v ?? '');
        }
      });
      if (vals.some((v) => v.trim())) {
        console.log(`R${rowNumber}:`, vals.join(' | '));
        count++;
      }
    });
  }
}

main().catch((e) => {
  console.error('ERROR', e);
  process.exit(1);
});
