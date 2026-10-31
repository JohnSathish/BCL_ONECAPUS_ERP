import { resolveCopyIssue } from '../domain/library-copy-issue.logic';
import type { CopyIssueRules } from '../domain/library-policy.types';

export type DetailStatus =
  | 'Available'
  | 'Issued'
  | 'Reserved'
  | 'Not for Issue'
  | 'Damaged'
  | 'Lost'
  | 'Withdrawn';

export type DetailCopy = {
  copyId: string;
  bookId: string;
  /** One label used on the consolidated sheet so a copy is not counted twice. */
  department: string;
  /** Every department this title is mapped to. */
  departments: string[];
  title: string;
  author: string;
  isbn: string;
  edition: string;
  publisher: string;
  year: string;
  subject: string;
  accession: string;
  barcode: string;
  callNumber: string;
  copyType: string;
  status: DetailStatus | string;
};

export function detailCopyTypeLabel(
  copyType: string | null | undefined,
  bookType: string | null | undefined,
): string {
  const book = bookType?.trim().toUpperCase() ?? '';
  if (!copyType?.trim()) {
    if (book === 'JOURNAL') return 'Journal';
    if (book === 'PERIODICAL') return 'Periodical';
    if (book === 'REFERENCE') return 'Reference';
    return 'Normal';
  }
  switch (copyType.trim().toUpperCase()) {
    case 'GENERAL':
      return 'Normal';
    case 'REFERENCE':
      return 'Reference';
    case 'RARE':
      return 'Rare';
    case 'TEXTBOOK':
      return 'Textbook';
    case 'RESERVE':
      return 'Reserve';
    case 'RESTRICTED':
      return 'Restricted';
    case 'JOURNAL':
      return 'Journal';
    case 'PERIODICAL':
      return 'Periodical';
    default:
      return copyType.trim();
  }
}

export function detailAvailability(input: {
  status: string;
  onLoan: boolean;
  issueAllowed: boolean | null;
  copyType: string | null;
  categoryCode: string | null;
  copyIssue: CopyIssueRules;
  referenceAllow: boolean;
  rareAllow: boolean;
}): DetailStatus | string {
  if (input.onLoan) return 'Issued';
  const raw = input.status.trim().toUpperCase();
  if (raw === 'LOST' || raw === 'MISSING') return 'Lost';
  if (raw === 'DAMAGED') return 'Damaged';
  if (raw === 'WITHDRAWN') return 'Withdrawn';
  if (raw === 'RESERVED' || raw === 'ON_HOLD') return 'Reserved';
  const issue = resolveCopyIssue({
    copyType: input.copyType,
    issueAllowed: input.issueAllowed,
    categoryCode: input.categoryCode,
    copyIssue: input.copyIssue,
    referenceAllow: input.referenceAllow,
    rareAllow: input.rareAllow,
  });
  if (!issue.allowed) return 'Not for Issue';
  if (raw === 'AVAILABLE' || raw === '') return 'Available';
  return titleCase(input.status);
}

export type DepartmentMetrics = {
  titles: number;
  copies: number;
  accessions: number;
  available: number;
  issued: number;
  reference: number;
  reserved: number;
  damaged: number;
  lost: number;
  withdrawn: number;
  yearRange: string;
};

export function summarizeCopies(rows: DetailCopy[]): DepartmentMetrics {
  const books = new Set<string>();
  let accessions = 0;
  let available = 0;
  let issued = 0;
  let reference = 0;
  let reserved = 0;
  let damaged = 0;
  let lost = 0;
  let withdrawn = 0;
  for (const row of rows) {
    books.add(row.bookId);
    if (row.accession.trim()) accessions += 1;
    if (row.status === 'Available') available += 1;
    if (row.status === 'Issued') issued += 1;
    if (row.copyType === 'Reference') reference += 1;
    if (row.status === 'Reserved') reserved += 1;
    if (row.status === 'Damaged') damaged += 1;
    if (row.status === 'Lost') lost += 1;
    if (row.status === 'Withdrawn') withdrawn += 1;
  }
  return {
    titles: books.size,
    copies: rows.length,
    accessions,
    available,
    issued,
    reference,
    reserved,
    damaged,
    lost,
    withdrawn,
    yearRange: publicationYearRange(rows),
  };
}

export function publicationYearRange(rows: DetailCopy[]): string {
  const years = rows
    .map((row) => numericYear(row.year))
    .filter((year): year is number => year != null);
  if (!years.length) return '';
  const low = Math.min(...years);
  const high = Math.max(...years);
  return low === high ? String(low) : `${low} – ${high}`;
}

export function publicationYearSummary(rows: DetailCopy[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const year = row.year.trim() || '(No year)';
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => compareYear(left[0], right[0]))
    .map(([year, copies]) => ({ year, copies }));
}

export function subjectSummary(rows: DetailCopy[]) {
  const groups = new Map<string, DetailCopy[]>();
  for (const row of rows) {
    const subject = row.subject.trim() || '(No subject)';
    const list = groups.get(subject) ?? [];
    list.push(row);
    groups.set(subject, list);
  }
  return [...groups.entries()]
    .map(([subject, copies]) => {
      const metrics = summarizeCopies(copies);
      return {
        subject,
        titles: metrics.titles,
        copies: metrics.copies,
        available: metrics.available,
        issued: metrics.issued,
        reference: metrics.reference,
      };
    })
    .sort(
      (left, right) =>
        right.copies - left.copies || left.subject.localeCompare(right.subject),
    );
}

export function copyTypeSummary(rows: DetailCopy[]) {
  const groups = new Map<string, DetailCopy[]>();
  for (const row of rows) {
    const type = row.copyType.trim() || 'Normal';
    const list = groups.get(type) ?? [];
    list.push(row);
    groups.set(type, list);
  }
  return [...groups.entries()]
    .map(([copyType, copies]) => ({
      copyType,
      copies: copies.length,
      available: copies.filter((row) => row.status === 'Available').length,
      notForIssue: copies.filter((row) => row.status === 'Not for Issue')
        .length,
    }))
    .sort(
      (left, right) =>
        right.copies - left.copies ||
        left.copyType.localeCompare(right.copyType),
    );
}

export function rowsForDepartment(rows: DetailCopy[], department: string) {
  return rows.filter((row) =>
    department === '(Unmapped)'
      ? row.departments.length === 0
      : row.departments.includes(department),
  );
}

export function excelSheetName(name: string, used: Set<string>): string {
  const cleaned =
    name
      .replace(/[\\/*?:[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Department';
  const base = cleaned.slice(0, 31);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) {
    const tail = ` ${suffix}`;
    candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function sortCopies(rows: DetailCopy[]): DetailCopy[] {
  return [...rows].sort(
    (left, right) =>
      left.department.localeCompare(right.department) ||
      left.accession.localeCompare(right.accession, undefined, {
        numeric: true,
      }) ||
      left.title.localeCompare(right.title),
  );
}

function numericYear(value: string): number | null {
  const match = value.trim().match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return year >= 1000 && year <= 3000 ? year : null;
}

function compareYear(left: string, right: string) {
  const a = numericYear(left);
  const b = numericYear(right);
  if (a != null && b != null && a !== b) return a - b;
  return left.localeCompare(right);
}

function titleCase(value: string) {
  const clean = value.trim();
  if (!clean) return 'Available';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}
