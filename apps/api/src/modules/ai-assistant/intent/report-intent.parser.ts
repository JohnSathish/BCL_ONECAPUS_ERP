import { STUDENT_REPORT_FIELDS } from '../../student-reports/domain/student-report-field-registry';
import type { AiIntentFilters } from '../ai-assistant.types';

export type ParsedStudentReportSpec = {
  reportType: 'student_report';
  filters: AiIntentFilters;
  columns: string[];
  format: 'xlsx' | 'csv';
  filterLabels: string[];
  columnLabels: string[];
};

/** Common subject misspellings in natural-language prompts */
const SUBJECT_NORMALIZE: Record<string, string> = {
  pholosophy: 'philosophy',
  philosphy: 'philosophy',
  politicl: 'political',
  economis: 'economics',
  commerece: 'commerce',
};

const DEFAULT_STUDENT_REPORT_COLUMNS = [
  'fullName',
  'enrollmentNumber',
  'rollNumber',
  'programme',
  'currentSemester',
  'majorDepartment',
  'gender',
  'mobileNumber',
];

/**
 * Ordered column synonyms — longer / more specific patterns first.
 */
const COLUMN_SYNONYMS: Array<{ test: (t: string) => boolean; key: string }> = [
  {
    test: (t) => /nehu\s+roll|university\s+roll/.test(t),
    key: 'universityRollNumber',
  },
  {
    test: (t) => /nehu\s+registration|university\s+registration/.test(t),
    key: 'universityRegistrationNumber',
  },
  {
    test: (t) => /college\s+roll/.test(t),
    key: 'rollNumber',
  },
  {
    test: (t) =>
      /^name$/.test(t) || /^student\s+name$/.test(t) || /^full\s+name$/.test(t),
    key: 'fullName',
  },
  {
    test: (t) =>
      /registration\s*(no|number)?/.test(t) && !/nehu|university/.test(t),
    key: 'enrollmentNumber',
  },
  {
    test: (t) => /^roll\s*(no|number)?$/.test(t),
    key: 'rollNumber',
  },
  {
    test: (t) => /gender|sex/.test(t),
    key: 'gender',
  },
  {
    test: (t) => /mobile|phone|whatsapp/.test(t),
    key: 'mobileNumber',
  },
  {
    test: (t) => /email/.test(t),
    key: 'email',
  },
  {
    test: (t) => /father/.test(t),
    key: 'fatherName',
  },
  {
    test: (t) => /mother/.test(t),
    key: 'motherName',
  },
  {
    test: (t) => /aadhaar|aadhar|national\s*id/.test(t),
    key: 'nationalId',
  },
  {
    test: (t) => /programme|program/.test(t),
    key: 'programme',
  },
  {
    test: (t) => /semester/.test(t),
    key: 'currentSemester',
  },
  {
    test: (t) => /department/.test(t) && !/major|minor/.test(t),
    key: 'department',
  },
  {
    test: (t) => /major/.test(t),
    key: 'majorDepartment',
  },
  {
    test: (t) => /minor/.test(t),
    key: 'minorDepartment',
  },
  {
    test: (t) => /shift/.test(t),
    key: 'shift',
  },
  {
    test: (t) => /dob|date\s*of\s*birth|birth\s*date/.test(t),
    key: 'dateOfBirth',
  },
  {
    test: (t) => /category/.test(t),
    key: 'category',
  },
  {
    test: (t) => /blood\s*group/.test(t),
    key: 'bloodGroup',
  },
  {
    test: (t) => /address/.test(t),
    key: 'permanentAddress',
  },
];

const FIELD_BY_LABEL = new Map(
  STUDENT_REPORT_FIELDS.map((f) => [f.label.toLowerCase(), f.key]),
);

export function parseStudentReportIntent(
  question: string,
): ParsedStudentReportSpec | null {
  const q = question.trim();
  const lower = q.toLowerCase();
  if (!isStudentReportPrompt(lower)) return null;

  const filters = extractReportFilters(q, lower);
  const explicitColumns = extractExplicitColumns(q);
  const aliasColumns = extractColumnsFromAliases(q);
  const columns = explicitColumns.length
    ? explicitColumns
    : aliasColumns.length
      ? aliasColumns
      : [];

  const format = /\bcsv\b/.test(lower)
    ? 'csv'
    : /\bexcel\b|\bxlsx\b|\bspreadsheet\b|\bpdf\b/.test(lower)
      ? 'xlsx'
      : 'xlsx';

  const filterLabels = describeFilters(filters);
  const columnLabels = columns.map((key) => labelForKey(key));

  return {
    reportType: 'student_report',
    filters,
    columns,
    format,
    filterLabels,
    columnLabels,
  };
}

export function defaultStudentReportColumns() {
  return [...DEFAULT_STUDENT_REPORT_COLUMNS];
}

function isStudentReportPrompt(lower: string) {
  return (
    (/\b(generate|export|download|create|prepare)\b/.test(lower) &&
      /\b(report|excel|csv|list|register)\b/.test(lower)) ||
    /\bstudent\s+report\b|\badmission\s+report\b|\badmission\s+register\b/.test(
      lower,
    ) ||
    (/\breport\b/.test(lower) &&
      /\bstudent/.test(lower) &&
      /\b(with|major|minor|semester|fields?|columns?)\b/.test(lower))
  );
}

function extractReportFilters(q: string, lower: string): AiIntentFilters {
  const filters: AiIntentFilters = {};

  if (/\bb\.?\s*com\b|\bcommerce\b|\bbcom\b/.test(lower)) {
    filters.programmeFamily = 'BCOM';
    filters.programmeName = 'FYUP in Commerce';
  } else if (/\bb\.?\s*sc\b|\bscience\b|\bbsc\b/.test(lower)) {
    filters.programmeFamily = 'BSC';
  } else if (/\bb\.?\s*a\b|\barts\b|\bba\b/.test(lower)) {
    filters.programmeFamily = 'BA';
  }

  const fyupMatch = lower.match(
    /\bfyup\s+in\s+([a-z][a-z\s]+?)(?:\s+major|\s+minor|\s+students?|\s+report|,|$)/i,
  );
  if (fyupMatch) {
    filters.programmeName = `FYUP in ${titleCase(fyupMatch[1].trim())}`;
  }

  const major = extractMajorName(q, lower);
  if (major) filters.majorSubjectName = major;

  const minor = extractMinorName(q, lower);
  if (minor) filters.minorSubjectName = minor;

  const deptMatch = lower.match(
    /\b(?:department\s+of\s+|dept\.?\s+of\s+)([a-z][a-z\s]+?)(?:\s+students?|\s+report|,|$)/i,
  );
  if (deptMatch) filters.departmentName = titleCase(deptMatch[1].trim());

  const shiftMatch = lower.match(
    /\b(morning|day|evening|afternoon)\s+shift\b/i,
  );
  if (shiftMatch) filters.shiftName = titleCase(shiftMatch[1]);

  const semMatch = lower.match(
    /\bsem(?:ester)?\s*([1-8]|i{1,3}|iv|v?i{0,3})\b/i,
  );
  if (semMatch) {
    const token = semMatch[1].toLowerCase();
    const roman: Record<string, number> = {
      i: 1,
      ii: 2,
      iii: 3,
      iv: 4,
      v: 5,
      vi: 6,
      vii: 7,
      viii: 8,
    };
    const n = /^\d+$/.test(token) ? Number(token) : (roman[token] ?? null);
    if (n != null && n >= 1 && n <= 8) filters.semester = n;
  }

  if (/\bgirls?\b|\bfemale\b|\bwomen\b/.test(lower)) filters.gender = 'FEMALE';
  if (/\bboys?\b|\bmale\b|\bmen\b/.test(lower)) filters.gender = 'MALE';

  if (/pending\s+fee|outstanding|defaulter|overdue/.test(lower)) {
    filters.feeStatus = 'DUE';
  }

  if (/without\s+aadhaar|no\s+aadhaar|missing\s+aadhaar/.test(lower)) {
    filters.missingAadhaar = true;
  }
  if (/without\s+photo|no\s+photo|missing\s+photo/.test(lower)) {
    filters.missingPhoto = true;
  }
  if (/without\s+mobile|no\s+mobile|missing\s+mobile/.test(lower)) {
    filters.missingMobile = true;
  }

  return filters;
}

function extractMajorName(q: string, lower: string): string | undefined {
  const patterns = [
    /\bstudent\s+report\s+of\s+([a-z][a-z\s]{2,30}?)\s+major\b/i,
    /\breport\s+of\s+([a-z][a-z\s]{2,30}?)\s+major\b/i,
    /\b(?:report|list|students?)\s+of\s+([a-z][a-z\s]+?)\s+major\b/i,
    /\bmajor\s+(?:in\s+|of\s+)?([a-z][a-z\s]{2,30}?)(?:\s+with|\s+students?|\s+report|,|$)/i,
    /\b([a-z][a-z\s]{2,30}?)\s+major\b/i,
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (m?.[1]) {
      const raw = m[1].trim();
      if (isBoilerplateSubject(raw)) continue;
      return normalizeSubjectName(raw);
    }
  }
  const ofMatch = lower.match(
    /\b(?:report|list|students?)\s+of\s+([a-z][a-z\s]+?)\s+major\b/i,
  );
  if (ofMatch?.[1] && !isBoilerplateSubject(ofMatch[1])) {
    return normalizeSubjectName(ofMatch[1].trim());
  }
  return undefined;
}

function isBoilerplateSubject(raw: string) {
  return /\b(student|report|prepare|generate|list|export|download|create|excel|csv)\b/i.test(
    raw,
  );
}

function extractMinorName(q: string, lower: string): string | undefined {
  const m =
    q.match(/\b([a-z][a-z\s]{2,30}?)\s+minor\b/i) ||
    q.match(/\bminor\s+(?:in\s+)?([a-z][a-z\s]{2,30}?)(?:\s+with|,|$)/i);
  if (m?.[1]) return normalizeSubjectName(m[1].trim());
  return undefined;
}

function normalizeSubjectName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  const words = cleaned.split(' ').map((w) => SUBJECT_NORMALIZE[w] ?? w);
  return titleCase(words.join(' '));
}

function titleCase(s: string) {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Parse "with Name, NEHU Roll Number, Gender, ... fields" */
function extractExplicitColumns(q: string): string[] {
  const m = q.match(
    /\bwith\s+(.+?)(?:\s+fields?\b|\s+columns?\b|\s+in\s+(?:excel|csv)\b|$)/i,
  );
  if (!m) return [];

  const segment = m[1].replace(/\s+and\s+/gi, ',').replace(/\s*,\s*/g, ',');
  const parts = segment
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const keys: string[] = [];
  for (const part of parts) {
    const key = resolveColumnToken(part);
    if (key) keys.push(key);
  }
  return [...new Set(keys)];
}

function extractColumnsFromAliases(q: string): string[] {
  const keys = new Set<string>();
  const lower = q.toLowerCase();

  for (const field of STUDENT_REPORT_FIELDS) {
    if (lower.includes(field.label.toLowerCase())) {
      keys.add(field.key);
    }
  }

  for (const { test, key } of COLUMN_SYNONYMS) {
    if (test(lower)) keys.add(key);
  }

  return [...keys];
}

function resolveColumnToken(token: string): string | null {
  const t = token
    .toLowerCase()
    .trim()
    .replace(/\s+fields?$/i, '');
  for (const { test, key } of COLUMN_SYNONYMS) {
    if (test(t)) return key;
  }
  const fromLabel = FIELD_BY_LABEL.get(t);
  if (fromLabel) return fromLabel;
  return null;
}

function labelForKey(key: string) {
  return STUDENT_REPORT_FIELDS.find((f) => f.key === key)?.label ?? key;
}

function describeFilters(filters: AiIntentFilters): string[] {
  const lines: string[] = [];
  if (filters.majorSubjectName)
    lines.push(`Major: ${filters.majorSubjectName}`);
  if (filters.minorSubjectName)
    lines.push(`Minor: ${filters.minorSubjectName}`);
  if (filters.programmeName) lines.push(`Programme: ${filters.programmeName}`);
  if (filters.programmeFamily) {
    lines.push(
      `Programme family: ${filters.programmeFamily === 'BCOM' ? 'Commerce' : filters.programmeFamily === 'BSC' ? 'Science' : 'Arts'}`,
    );
  }
  if (filters.departmentName)
    lines.push(`Department: ${filters.departmentName}`);
  if (filters.shiftName) lines.push(`Shift: ${filters.shiftName}`);
  if (filters.semester) lines.push(`Semester: ${filters.semester}`);
  if (filters.gender) lines.push(`Gender: ${filters.gender}`);
  if (filters.feeStatus) lines.push('Fee status: Outstanding');
  if (filters.missingAadhaar) lines.push('Missing Aadhaar');
  if (filters.missingPhoto) lines.push('Missing photo');
  if (filters.missingMobile) lines.push('Missing mobile');
  return lines;
}

export function buildReportPreviewMarkdown(
  spec: ParsedStudentReportSpec,
  rowCount: number,
) {
  const cols =
    spec.columns.length > 0
      ? spec.columnLabels
      : defaultStudentReportColumns().map(labelForKey);

  const filterBlock =
    spec.filterLabels.length > 0
      ? spec.filterLabels.map((f) => `✓ ${f}`).join('\n')
      : '✓ All students (no filter detected — specify Major, Semester, etc. to narrow)';

  return [
    'Generating Student Report…',
    '',
    '**Report Type:** Student Report',
    '',
    '**Filters applied**',
    filterBlock,
    '',
    `**Estimated rows:** ${rowCount}`,
    '',
    '**Columns selected**',
    ...cols.map((c) => `✓ ${c}`),
    '',
    '**Output**',
    `✓ ${spec.format.toUpperCase()}`,
    '',
    rowCount > 0
      ? 'Reply **Yes, generate report** or click **Generate report** to download.'
      : 'No students match these filters. Adjust your request before generating.',
  ].join('\n');
}
