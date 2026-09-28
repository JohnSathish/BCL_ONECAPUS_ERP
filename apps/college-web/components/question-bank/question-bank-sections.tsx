import Form from 'next/form';
import Link from 'next/link';
import {
  CalendarDays,
  Download,
  FileSearch,
  FileText,
  Funnel,
  RotateCcw,
  Search,
} from 'lucide-react';
import { QuestionBankSortSelect } from '@/components/question-bank/question-bank-sort';
import {
  QB_FILTER_KEYS,
  QB_SORTS,
  QUESTION_BANK_PATH,
  formatFileSize,
  formatQbDate,
  paperHeading,
  qbDownloadHref,
  qbPaperHref,
  type QbDownloadMode,
  type QbFilterOptions,
  type QbOption,
  type QbPaper,
  type QbQuery,
} from '@/lib/question-bank';

function HiddenFields({ query, keys }: { query: QbQuery; keys: ReadonlyArray<keyof QbQuery> }) {
  return (
    <>
      {keys.map((key) =>
        query[key] ? <input key={key} type="hidden" name={key} value={query[key]} /> : null,
      )}
    </>
  );
}

function FilterSelect({
  id,
  label,
  allLabel,
  value,
  options,
}: {
  id: keyof QbQuery;
  label: string;
  allLabel: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
}) {
  const selectId = `qb-filter-${id}`;
  return (
    <div className="qb-field">
      <label htmlFor={selectId}>{label}</label>
      <select
        id={selectId}
        name={id}
        defaultValue={value ?? ''}
        className="qb-select"
        disabled={!options.length && !value}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const toOptions = (items: QbOption[]) =>
  items.map((item) => ({ value: item.id, label: item.label }));

export function QuestionBankFilterForm({
  query,
  filters,
}: {
  query: QbQuery;
  filters: QbFilterOptions;
}) {
  const subjects = query.departmentId
    ? filters.subjects.filter(
        (subject) => !subject.parentId || subject.parentId === query.departmentId,
      )
    : filters.subjects;

  return (
    <section className="qb-filter-card" aria-labelledby="qb-filter-heading">
      <h2 id="qb-filter-heading" className="qb-filter-heading">
        <Funnel aria-hidden /> Filter Question Papers
      </h2>
      <Form action={QUESTION_BANK_PATH} className="qb-filter-form">
        <HiddenFields query={query} keys={['q', 'sort']} />
        <FilterSelect
          id="academicYearId"
          label="Academic Year"
          allLabel="All Academic Years"
          value={query.academicYearId}
          options={toOptions(filters.academicYears)}
        />
        <FilterSelect
          id="semester"
          label="Semester"
          allLabel="All Semesters"
          value={query.semester}
          options={filters.semesters.map((n) => ({ value: String(n), label: `Semester ${n}` }))}
        />
        <FilterSelect
          id="programmeId"
          label="Programme"
          allLabel="All Programmes"
          value={query.programmeId}
          options={toOptions(filters.programmes)}
        />
        <FilterSelect
          id="departmentId"
          label="Department"
          allLabel="All Departments"
          value={query.departmentId}
          options={toOptions(filters.departments)}
        />
        <FilterSelect
          id="majorId"
          label="Major"
          allLabel="All Majors"
          value={query.majorId}
          options={toOptions(filters.majors)}
        />
        <FilterSelect
          id="subjectId"
          label="Subject"
          allLabel="All Subjects"
          value={query.subjectId}
          options={subjects.map((subject) => ({
            value: subject.id,
            label: subject.code ? `${subject.label} (${subject.code})` : subject.label,
          }))}
        />
        <FilterSelect
          id="subjectCode"
          label="Subject Code"
          allLabel="All Subject Codes"
          value={query.subjectCode}
          options={filters.subjectCodes.map((code) => ({ value: code, label: code }))}
        />
        <FilterSelect
          id="examTypeId"
          label="Examination Type"
          allLabel="All Types"
          value={query.examTypeId}
          options={toOptions(filters.examTypes)}
        />
        <FilterSelect
          id="examYear"
          label="Year"
          allLabel="All Years"
          value={query.examYear}
          options={filters.examYears.map((year) => ({ value: String(year), label: String(year) }))}
        />
        <div className="qb-filter-actions">
          <button type="submit" className="qb-button qb-button-primary">
            <Search aria-hidden /> Apply Filters
          </button>
          <Link href={QUESTION_BANK_PATH} className="qb-button qb-button-muted">
            <RotateCcw aria-hidden /> Clear Filters
          </Link>
        </div>
      </Form>
    </section>
  );
}

export function QuestionBankSearchBar({ query }: { query: QbQuery }) {
  return (
    <Form action={QUESTION_BANK_PATH} className="qb-search" role="search">
      <HiddenFields query={query} keys={[...QB_FILTER_KEYS, 'sort']} />
      <label htmlFor="qb-search-input" className="sr-only">
        Search question papers
      </label>
      <Search aria-hidden className="qb-search-icon" />
      <input
        id="qb-search-input"
        type="search"
        name="q"
        defaultValue={query.q ?? ''}
        maxLength={120}
        placeholder="Search by subject, subject code, programme, department or paper title…"
        autoComplete="off"
      />
      <button type="submit" className="qb-button qb-button-primary">
        Search
      </button>
    </Form>
  );
}

export function QuestionBankResultsHeader({
  query,
  total,
  rangeStart,
  rangeEnd,
}: {
  query: QbQuery;
  total: number;
  rangeStart: number;
  rangeEnd: number;
}) {
  const summary = !total
    ? 'No question papers found'
    : total <= rangeEnd - rangeStart + 1
      ? `Showing ${total} question paper${total === 1 ? '' : 's'}`
      : `Showing ${rangeStart}–${rangeEnd} of ${total} question papers`;
  return (
    <div className="qb-results-header">
      <div>
        <h2>Question Papers</h2>
        <p role="status" aria-live="polite">
          {summary}
          {query.q ? (
            <>
              {' '}
              for “<strong>{query.q}</strong>”
            </>
          ) : null}
        </p>
      </div>
      <Form action={QUESTION_BANK_PATH} className="qb-sort">
        <HiddenFields query={query} keys={['q', ...QB_FILTER_KEYS]} />
        <label htmlFor="qb-sort">Sort by</label>
        <QuestionBankSortSelect value={query.sort ?? 'newest'} options={QB_SORTS} />
        <noscript>
          <button type="submit" className="qb-button qb-button-muted">
            Sort
          </button>
        </noscript>
      </Form>
    </div>
  );
}

export function QuestionPaperCard({
  paper,
  downloadMode,
}: {
  paper: QbPaper;
  downloadMode: QbDownloadMode;
}) {
  const heading = paperHeading(paper);
  const size = formatFileSize(paper.fileBytes);
  const newTab = downloadMode === 'NEW_TAB';
  const meta = [
    paper.programme?.label,
    paper.semester ? `Semester ${paper.semester}` : null,
    paper.department && paper.department.label !== paper.programme?.label
      ? paper.department.label
      : null,
  ].filter(Boolean);
  const titleDiffers = paper.title.trim() && paper.title.trim() !== heading;
  const downloadLabel = `Download PDF: ${heading}${size ? ` (${size})` : ''}${
    newTab ? ', opens in a new tab' : ''
  }`;

  return (
    <li className="qb-card">
      <span className="qb-card-icon" aria-hidden>
        <FileText />
        <span>PDF</span>
      </span>
      <div className="qb-card-body">
        <h3>
          <Link href={qbPaperHref(paper.slug)}>{heading}</Link>
        </h3>
        {titleDiffers ? <p className="qb-card-title">{paper.title}</p> : null}
        {meta.length ? (
          <p className="qb-card-meta">
            {meta.map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </p>
        ) : null}
        <ul className="qb-chips" aria-label="Paper details">
          {paper.academicYear ? (
            <li className="qb-chip qb-chip-year">{paper.academicYear.label}</li>
          ) : null}
          {paper.examType ? <li className="qb-chip qb-chip-type">{paper.examType.label}</li> : null}
          {paper.examYear ? <li className="qb-chip">Exam {paper.examYear}</li> : null}
          {paper.major ? <li className="qb-chip">Major: {paper.major.label}</li> : null}
        </ul>
      </div>
      <div className="qb-card-date">
        <CalendarDays aria-hidden />
        <span>
          Published on
          <time dateTime={paper.publishedAt ?? undefined}>{formatQbDate(paper.publishedAt)}</time>
        </span>
      </div>
      <a
        className="qb-button qb-button-primary qb-download"
        href={qbDownloadHref(paper.slug)}
        {...(newTab ? { target: '_blank', rel: 'noopener' } : { download: '' })}
        aria-label={downloadLabel}
      >
        <Download aria-hidden />
        <span>
          Download PDF
          {size ? <small>({size})</small> : null}
        </span>
      </a>
    </li>
  );
}

export function QuestionBankEmptyState({
  hasFilters,
  unavailable,
}: {
  hasFilters: boolean;
  unavailable?: boolean;
}) {
  return (
    <div className="qb-empty" role="status">
      <span className="qb-empty-icon" aria-hidden>
        <FileSearch />
      </span>
      <h3>
        {unavailable
          ? 'Question papers are temporarily unavailable'
          : hasFilters
            ? 'No question papers match your filters'
            : 'No question papers published yet'}
      </h3>
      <p>
        {unavailable
          ? 'Please refresh the page in a few moments.'
          : hasFilters
            ? 'Try removing a filter, choosing a different academic year, or searching with a subject code.'
            : 'Previous question papers will appear here as soon as the college publishes them.'}
      </p>
      {hasFilters && !unavailable ? (
        <Link href={QUESTION_BANK_PATH} className="qb-button qb-button-primary">
          <RotateCcw aria-hidden /> Clear Filters
        </Link>
      ) : null}
    </div>
  );
}
