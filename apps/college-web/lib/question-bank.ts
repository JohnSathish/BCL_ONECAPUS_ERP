import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';

export const QUESTION_BANK_PATH = '/academics/question-bank';
export const QUESTION_BANK_TITLE = 'Question Bank & Previous Question Papers';

export type QbOption = { id: string; label: string; code?: string; parentId?: string };

export type QbDownloadMode = 'NEW_TAB' | 'DOWNLOAD';

export type QbFilterOptions = {
  total: number;
  academicYears: QbOption[];
  programmes: QbOption[];
  departments: QbOption[];
  categories: QbOption[];
  subjects: QbOption[];
  examTypes: QbOption[];
  semesters: number[];
  examYears: number[];
  subjectCodes: string[];
  settings: { downloadMode: QbDownloadMode; pageSize: number; intro: string };
};

export type QbPaper = {
  id: string;
  slug: string;
  title: string;
  subjectName: string;
  subjectCode: string;
  semester: number | null;
  examYear: number | null;
  description: string;
  publishedAt: string | null;
  updatedAt: string;
  academicYear: QbOption | null;
  programme: QbOption | null;
  department: QbOption | null;
  category: QbOption | null;
  subject: QbOption | null;
  examType: QbOption | null;
  fileBytes: number;
};

export type QbListResult = {
  items: QbPaper[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  downloadMode: QbDownloadMode;
};

export const QB_SORTS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'subject_code', label: 'Subject Code' },
  { value: 'exam_year', label: 'Examination Year' },
] as const;

export type QbSort = (typeof QB_SORTS)[number]['value'];

export type QbQuery = {
  q?: string;
  academicYearId?: string;
  semester?: string;
  programmeId?: string;
  departmentId?: string;
  category?: string;
  subjectId?: string;
  subjectCode?: string;
  examType?: string;
  examYear?: string;
  sort?: QbSort;
  page?: string;
};

/** Filter keys shown in the sidebar (order matters for hidden-field round trips). */
export const QB_FILTER_KEYS = [
  'academicYearId',
  'semester',
  'programmeId',
  'departmentId',
  'category',
  'subjectId',
  'subjectCode',
  'examType',
  'examYear',
] as const satisfies ReadonlyArray<keyof QbQuery>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBJECT_CODE = /^[A-Za-z0-9 ./_-]{1,40}$/;
const ENUM_VALUE = /^[A-Z_]{2,32}$/;

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? '';

/** Drops anything the API would reject so hand-edited URLs never break the page. */
export function parseQbQuery(params: RawParams): QbQuery {
  const query: QbQuery = {};
  const q = first(params.q).replace(/[<>]/g, '').slice(0, 120);
  if (q) query.q = q;
  for (const key of ['academicYearId', 'programmeId', 'departmentId', 'subjectId'] as const) {
    const value = first(params[key]);
    if (UUID.test(value)) query[key] = value.toLowerCase();
  }
  for (const key of ['category', 'examType'] as const) {
    const value = first(params[key]).toUpperCase();
    if (ENUM_VALUE.test(value)) query[key] = value;
  }
  const semester = Number.parseInt(first(params.semester), 10);
  if (semester >= 1 && semester <= 12) query.semester = String(semester);
  const examYear = Number.parseInt(first(params.examYear), 10);
  if (examYear >= 1990 && examYear <= 2100) query.examYear = String(examYear);
  const code = first(params.subjectCode);
  if (SUBJECT_CODE.test(code)) query.subjectCode = code;
  const sort = first(params.sort);
  if (QB_SORTS.some((item) => item.value === sort)) query.sort = sort as QbSort;
  const page = Number.parseInt(first(params.page), 10);
  if (page > 1 && page < 100000) query.page = String(page);
  return query;
}

export function activeQbFilterCount(query: QbQuery) {
  return QB_FILTER_KEYS.filter((key) => Boolean(query[key])).length;
}

export function qbHref(query: QbQuery, overrides: Partial<QbQuery> = {}) {
  const merged: QbQuery = { ...query, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (!value) continue;
    if (key === 'sort' && value === 'newest') continue;
    if (key === 'page' && value === '1') continue;
    qs.set(key, value);
  }
  const raw = qs.toString();
  return raw ? `${QUESTION_BANK_PATH}?${raw}` : QUESTION_BANK_PATH;
}

export const qbPaperHref = (slug: string) => `${QUESTION_BANK_PATH}/${slug}`;
export const qbDownloadHref = (slug: string) => `${QUESTION_BANK_PATH}/${slug}/download`;

function mapOption(value: unknown): QbOption | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string') {
    return null;
  }
  return {
    id: value.id,
    label: value.label,
    ...(typeof value.code === 'string' && value.code ? { code: value.code } : {}),
    ...(typeof value.parentId === 'string' ? { parentId: value.parentId } : {}),
  };
}

const mapOptions = (value: unknown) =>
  Array.isArray(value) ? value.map(mapOption).filter((row): row is QbOption => Boolean(row)) : [];

const numberList = (value: unknown) =>
  Array.isArray(value) ? value.filter((n): n is number => typeof n === 'number') : [];

const downloadMode = (value: unknown): QbDownloadMode =>
  value === 'DOWNLOAD' ? 'DOWNLOAD' : 'NEW_TAB';

function mapPaper(value: unknown): QbPaper | null {
  if (!isRecord(value) || typeof value.slug !== 'string' || typeof value.title !== 'string') {
    return null;
  }
  const str = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : '');
  const num = (key: string) => (typeof value[key] === 'number' ? (value[key] as number) : null);
  const file = isRecord(value.file) ? value.file : null;
  return {
    id: str('id'),
    slug: value.slug,
    title: value.title,
    subjectName: str('subjectName'),
    subjectCode: str('subjectCode'),
    semester: num('semester'),
    examYear: num('examYear'),
    description: str('description'),
    publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : null,
    updatedAt: str('updatedAt') || new Date().toISOString(),
    academicYear: mapOption(value.academicYear),
    programme: mapOption(value.programme),
    department: mapOption(value.department),
    category: mapOption(value.category),
    subject: mapOption(value.subject),
    examType: mapOption(value.examType),
    fileBytes: file && typeof file.bytes === 'number' ? file.bytes : 0,
  };
}

export async function getQuestionBankFilters(): Promise<QbFilterOptions | null> {
  const raw = await fetchCms('question-bank/filters', {}, 120);
  if (!isRecord(raw)) return null;
  const settings = isRecord(raw.settings) ? raw.settings : {};
  return {
    total: typeof raw.total === 'number' ? raw.total : 0,
    academicYears: mapOptions(raw.academicYears),
    programmes: mapOptions(raw.programmes),
    departments: mapOptions(raw.departments),
    categories: mapOptions(raw.categories),
    subjects: mapOptions(raw.subjects),
    examTypes: mapOptions(raw.examTypes),
    semesters: numberList(raw.semesters),
    examYears: numberList(raw.examYears),
    subjectCodes: Array.isArray(raw.subjectCodes)
      ? raw.subjectCodes.filter((code): code is string => typeof code === 'string')
      : [],
    settings: {
      downloadMode: downloadMode(settings.downloadMode),
      pageSize: typeof settings.pageSize === 'number' ? settings.pageSize : 10,
      intro: typeof settings.intro === 'string' ? settings.intro : '',
    },
  };
}

export async function listQuestionPapers(query: QbQuery): Promise<QbListResult | null> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value) params[key] = value;
  }
  const raw = await fetchCms('question-bank/papers', params, 120, 8000);
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  return {
    items: raw.items.map(mapPaper).filter((row): row is QbPaper => Boolean(row)),
    total: typeof raw.total === 'number' ? raw.total : 0,
    page: typeof raw.page === 'number' ? raw.page : 1,
    pageSize: typeof raw.pageSize === 'number' ? raw.pageSize : 10,
    pageCount: typeof raw.pageCount === 'number' ? raw.pageCount : 1,
    downloadMode: downloadMode(raw.downloadMode),
  };
}

export async function getQuestionPaper(
  slug: string,
): Promise<(QbPaper & { downloadMode: QbDownloadMode }) | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const raw = await fetchCms(`question-bank/papers/${slug}`, {}, 120, 8000);
  const paper = mapPaper(raw);
  if (!paper || !isRecord(raw)) return null;
  return { ...paper, downloadMode: downloadMode(raw.downloadMode) };
}

export async function listQuestionPaperSitemap(): Promise<
  Array<{ slug: string; updatedAt: string }>
> {
  const raw = await fetchCms('question-bank/sitemap', {}, 600);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is { slug: string; updatedAt: string } =>
      isRecord(row) && typeof row.slug === 'string' && typeof row.updatedAt === 'string',
  );
}

export function paperHeading(paper: Pick<QbPaper, 'subjectCode' | 'subjectName' | 'title'>) {
  if (paper.subjectCode && paper.subjectName) return `${paper.subjectCode}: ${paper.subjectName}`;
  return paper.title;
}

export function formatQbDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatFileSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
