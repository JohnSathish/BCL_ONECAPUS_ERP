import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildArtsCourseImportRows } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';

const headers = [
  'Course Code',
  'Course Title',
  'Delivery Type',
  'Total Credits',
  'Theory Credits',
  'Practical Credits',
  'Weekly Theory Hours',
  'Weekly Practical Hours',
  'Total Theory Contact Hours',
  'Total Practical Contact Hours',
  'Total Contact Hours',
  'CBCS Catalog Type',
  'Department Code',
  'Description',
];

const rows = buildArtsCourseImportRows();
const escape = (value: string | number) => {
  const text = String(value);
  return text.includes(',') || text.includes('"')
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

const csv = [
  headers.join(','),
  ...rows.map((row) =>
    [
      row.courseCode,
      row.courseTitle,
      row.deliveryType,
      row.totalCredits,
      row.theoryCredits,
      row.practicalCredits,
      row.theoryHoursPerWeek,
      row.practicalHoursPerWeek,
      row.totalTheoryContactHours,
      row.totalPracticalContactHours,
      row.totalContactHours,
      row.cbcsType,
      row.departmentCode,
      'Arts FYUGP ODD semester catalog',
    ]
      .map(escape)
      .join(','),
  ),
].join('\n');

const outDir = join(__dirname, '..', 'prisma', 'data');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'arts-fyugp-odd-courses-import.csv');
writeFileSync(outPath, csv, 'utf8');
console.log(`Wrote ${rows.length} courses to ${outPath}`);
