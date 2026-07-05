/**
 * Quick smoke test for AI student report intent parsing.
 * Run: npx ts-node -r tsconfig-paths/register scripts/test-report-intent.ts
 */
import { parseStudentReportIntent } from '../src/modules/ai-assistant/intent/report-intent.parser';

const prompt =
  'Prepare Student report of Pholosophy Major with Name, NEHU Roll Number, Gender, College Roll Number, Mobile Number fields';

const spec = parseStudentReportIntent(prompt);
if (!spec) {
  console.error('FAIL: parser returned null');
  process.exit(1);
}

console.log('Parsed spec:', JSON.stringify(spec, null, 2));

const expectedColumns = [
  'fullName',
  'universityRollNumber',
  'gender',
  'rollNumber',
  'mobileNumber',
];

const okMajor = spec.filters.majorSubjectName === 'Philosophy';
const okCols =
  spec.columns.length === expectedColumns.length &&
  expectedColumns.every((c) => spec.columns.includes(c));

if (!okMajor) {
  console.error('FAIL: major =', spec.filters.majorSubjectName);
  process.exit(1);
}
if (!okCols) {
  console.error('FAIL: columns =', spec.columns);
  process.exit(1);
}

console.log('OK: Philosophy major + 5 columns parsed correctly');
