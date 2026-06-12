import { createWorkbookWithSheets } from '../../../common/import/excel.util';
import type { ParsedImportRow } from '../../../common/import/import.types';
import { isNepCategory } from '../domain/nep-categories';

export type UnpivotedRegistrationRow = {
  sourceRowNumber: number;
  registrationNumber: string;
  semesterSequence: number;
  category: string;
  courseCode: string;
  majorPaperIndex?: number;
  sectionCode?: string;
};

const REGISTRATION_NUMBER_KEYS = new Set([
  'registrationnumber',
  'enrollmentnumber',
  'rollnumber',
]);

const SEMESTER_KEYS = new Set([
  'semester',
  'semestersequence',
  'semesternumber',
  'sem',
]);

type WideCategorySpec = {
  category: string;
  majorPaperIndex?: number;
  pipeSplit?: boolean;
};

const WIDE_CATEGORY_COLUMNS: Record<string, WideCategorySpec> = {
  major: { category: 'MAJOR', pipeSplit: true },
  'major-1': { category: 'MAJOR', majorPaperIndex: 1 },
  'major-2': { category: 'MAJOR', majorPaperIndex: 2 },
  major1: { category: 'MAJOR', majorPaperIndex: 1 },
  major2: { category: 'MAJOR', majorPaperIndex: 2 },
  minor: { category: 'MINOR' },
  mdc: { category: 'MDC' },
  aec: { category: 'AEC' },
  sec: { category: 'SEC' },
  vac: { category: 'VAC' },
  vtc: { category: 'VTC' },
  internship: { category: 'VTC' },
};

export function normalizeWideHeaderKey(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '');
}

export function isWideCategoryColumnKey(key: string): boolean {
  return normalizeWideHeaderKey(key) in WIDE_CATEGORY_COLUMNS;
}

export function isWideRegistrationFormat(input: {
  headers?: string[];
  sampleRaw?: Record<string, unknown>;
}): boolean {
  const keys = (input.headers ?? Object.keys(input.sampleRaw ?? {})).map(
    normalizeWideHeaderKey,
  );
  if (keys.includes('category')) return false;

  const hasRegNo = keys.some((k) => REGISTRATION_NUMBER_KEYS.has(k));
  const hasSemester = keys.some((k) => SEMESTER_KEYS.has(k));
  const categoryCols = keys.filter((k) => k in WIDE_CATEGORY_COLUMNS);

  return hasRegNo && hasSemester && categoryCols.length >= 1;
}

export function resolveSemesterSequenceFromWideRow(
  raw: Record<string, unknown>,
): number | null {
  const rawVal =
    raw.semester ??
    raw.semestersequence ??
    raw.semesternumber ??
    raw.sem ??
    raw.semesterSequence;

  if (rawVal == null || rawVal === '') return null;
  if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
    return Math.floor(rawVal);
  }

  const text = String(rawVal).trim();
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const seq = Number(match[1]);
  return Number.isFinite(seq) && seq >= 1 ? seq : null;
}

function readRegistrationNumber(raw: Record<string, unknown>): string {
  const val =
    raw.registrationNumber ??
    raw.registrationnumber ??
    raw.enrollmentNumber ??
    raw.enrollmentnumber ??
    raw.rollNumber ??
    raw.rollnumber;
  return String(val ?? '').trim();
}

function readSectionCode(raw: Record<string, unknown>): string | undefined {
  const val = raw.sectionCode ?? raw.sectioncode;
  const code = String(val ?? '').trim();
  return code || undefined;
}

function cellText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function expandCategoryCell(
  columnKey: string,
  value: unknown,
): { category: string; courseCode: string; majorPaperIndex?: number }[] {
  const spec = WIDE_CATEGORY_COLUMNS[normalizeWideHeaderKey(columnKey)];
  if (!spec) return [];

  const text = cellText(value);
  if (!text) return [];

  if (spec.pipeSplit && text.includes('|')) {
    return text
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((courseCode, index) => ({
        category: spec.category,
        courseCode: courseCode.toUpperCase(),
        majorPaperIndex: index + 1,
      }));
  }

  return [
    {
      category: spec.category,
      courseCode: text.toUpperCase(),
      majorPaperIndex: spec.majorPaperIndex,
    },
  ];
}

export function unpivotWideRows(
  parsedRows: ParsedImportRow[],
): UnpivotedRegistrationRow[] {
  const longRows: UnpivotedRegistrationRow[] = [];

  for (const row of parsedRows) {
    const raw = row.raw;
    const registrationNumber = readRegistrationNumber(raw);
    const semesterSequence = resolveSemesterSequenceFromWideRow(raw);
    const sectionCode = readSectionCode(raw);
    const categoryKeys = Object.keys(raw).filter(isWideCategoryColumnKey);

    for (const columnKey of categoryKeys) {
      const expanded = expandCategoryCell(columnKey, raw[columnKey]);
      for (const entry of expanded) {
        if (!entry.courseCode) continue;
        longRows.push({
          sourceRowNumber: row.rowNumber,
          registrationNumber,
          semesterSequence: semesterSequence ?? 0,
          category: entry.category,
          courseCode: entry.courseCode,
          majorPaperIndex: entry.majorPaperIndex,
          sectionCode,
        });
      }
    }
  }

  return longRows;
}

export function unpivotWideRowsToParsedImportRows(
  parsedRows: ParsedImportRow[],
): ParsedImportRow[] {
  const unpivoted = unpivotWideRows(parsedRows);
  return unpivoted.map((row, index) => ({
    rowNumber: row.sourceRowNumber * 1000 + index + 1,
    raw: {
      registrationNumber: row.registrationNumber,
      semesterSequence: row.semesterSequence,
      category: row.category,
      courseCode: row.courseCode,
      ...(row.majorPaperIndex != null
        ? { majorPaperIndex: row.majorPaperIndex }
        : {}),
      ...(row.sectionCode ? { sectionCode: row.sectionCode } : {}),
      _wideSourceRowNumber: row.sourceRowNumber,
    },
  }));
}

export function validateUnpivotedCategory(category: string): boolean {
  return isNepCategory(category);
}

export async function buildWideTemplateWorkbook(): Promise<Buffer> {
  return createWorkbookWithSheets([
    {
      name: 'Registrations',
      headers: [
        'Registration Number',
        'Semester',
        'Major',
        'Minor',
        'MDC',
        'AEC',
        'SEC',
        'VAC',
        'VTC',
      ],
      rows: [
        [
          'REG2026001',
          1,
          'BCA-M101',
          'MAT-M101',
          'MDC101',
          'AEC-ENG',
          'SEC-PY',
          'VAC-ENV',
          '',
        ],
        [
          'REG2024001',
          5,
          'BCA-M501|BCA-M502',
          '',
          'MDC501',
          'AEC-ENG3',
          'SEC-501',
          '',
          'INT501',
        ],
      ],
      notes: [
        'One row per student per semester — category columns hold course codes.',
        'Semester: programme semester number (1, 3, 5, etc.).',
        'Major: single code, pipe-delimited (MAJOR-1|MAJOR-2), or use Major-1 / Major-2 columns.',
        'Leave category cells blank when not applicable.',
      ],
    },
    {
      name: 'Instructions',
      headers: ['Column', 'Description'],
      rows: [
        [
          'Registration Number (required)',
          'Student registration / enrollment number',
        ],
        ['Semester (required)', 'Programme semester sequence for this row'],
        ['Major', 'Major course code(s)'],
        ['Major-1 / Major-2', 'Optional split major paper columns'],
        ['Minor', 'Minor course code'],
        ['MDC', 'Multidisciplinary course code'],
        ['AEC', 'Ability enhancement course code'],
        ['SEC', 'Skill enhancement course code'],
        ['VAC', 'Value-added course code'],
        ['VTC / Internship', 'VTC or internship course code'],
      ],
    },
  ]);
}
