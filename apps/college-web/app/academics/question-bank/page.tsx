import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Landmark,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { QuestionBankFilterDrawer } from '@/components/question-bank/question-bank-filter-drawer';
import {
  QuestionBankEmptyState,
  QuestionBankFilterForm,
  QuestionBankResultsHeader,
  QuestionBankSearchBar,
  QuestionPaperCard,
} from '@/components/question-bank/question-bank-sections';
import { siteUrl } from '@/lib/content';
import { navigation } from '@/lib/navigation';
import {
  QUESTION_BANK_PATH,
  QUESTION_BANK_TITLE,
  activeQbFilterCount,
  getQuestionBankFilters,
  listQuestionPapers,
  paperHeading,
  parseQbQuery,
  qbHref,
  qbPaperHref,
  type QbFilterOptions,
} from '@/lib/question-bank';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const DEFAULT_LEAD = "Access previous years' question papers to support your academic preparation.";

const EMPTY_FILTERS: QbFilterOptions = {
  total: 0,
  academicYears: [],
  programmes: [],
  departments: [],
  categories: [],
  subjects: [],
  examTypes: [],
  semesters: [],
  examYears: [],
  subjectCodes: [],
  settings: { downloadMode: 'NEW_TAB', pageSize: 10, intro: '' },
};

const QUICK_LINK_ICONS: Record<string, LucideIcon> = {
  '/departments': GraduationCap,
  '/academics/programmes': BookOpen,
  '/academics/calendar': CalendarDays,
};

const quickLinks = [
  ...navigation
    .find((group) => group.label === 'Academics')!
    .items.filter(([, href]) => href !== QUESTION_BANK_PATH)
    .map(([label, href]) => ({ label, href, Icon: QUICK_LINK_ICONS[href] ?? Landmark })),
  { label: 'Notice Board', href: '/notices', Icon: Megaphone },
];

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = parseQbQuery(await searchParams);
  const isVariant = Object.keys(query).length > 0;
  const description =
    'Download previous years’ question papers of Don Bosco College, Tura by academic year, semester, programme, department, subject and examination type.';
  return {
    title: QUESTION_BANK_TITLE,
    description,
    alternates: { canonical: QUESTION_BANK_PATH },
    robots: isVariant ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: `${QUESTION_BANK_TITLE} | Don Bosco College Tura`,
      description,
      url: QUESTION_BANK_PATH,
      type: 'website',
    },
  };
}

export default async function QuestionBankPage({ searchParams }: Props) {
  const query = parseQbQuery(await searchParams);
  const [filterData, result] = await Promise.all([
    getQuestionBankFilters(),
    listQuestionPapers(query),
  ]);
  const filters = filterData ?? EMPTY_FILTERS;
  const activeCount = activeQbFilterCount(query);
  const hasFilters = activeCount > 0 || Boolean(query.q);
  const lead = filters.settings.intro || DEFAULT_LEAD;

  const total = result?.total ?? 0;
  const page = result?.page ?? 1;
  const pageSize = result?.pageSize ?? filters.settings.pageSize;
  const rangeStart = total ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, total);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: QUESTION_BANK_TITLE,
    url: `${siteUrl}${QUESTION_BANK_PATH}`,
    isPartOf: { '@type': 'CollegeOrUniversity', name: 'Don Bosco College Tura', url: siteUrl },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: (result?.items ?? []).map((paper, index) => ({
        '@type': 'ListItem',
        position: rangeStart + index,
        url: `${siteUrl}${qbPaperHref(paper.slug)}`,
        name: paperHeading(paper),
      })),
    },
  };

  return (
    <main id="main" className="inner-page qb-page">
      <header className="inner-page-hero qb-hero">
        <div className="shell inner-page-hero-copy">
          <nav className="inner-breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
                <ChevronRight aria-hidden />
              </li>
              <li>
                <span>Academics</span>
                <ChevronRight aria-hidden />
              </li>
              <li>
                <span aria-current="page">Question Bank</span>
              </li>
            </ol>
          </nav>
          <p className="inner-page-kicker">Don Bosco College Tura</p>
          <h1>{QUESTION_BANK_TITLE}</h1>
          <span className="inner-page-title-rule" aria-hidden />
          <p className="inner-page-lead">{lead}</p>
        </div>
      </header>

      <div className="shell qb-shell">
        <div className="qb-panel">
          <QuestionBankFilterDrawer activeCount={activeCount}>
            <QuestionBankFilterForm query={query} filters={filters} />
            <nav className="inner-quick-links qb-quick-links" aria-label="Academics quick links">
              <h2>Quick Links</h2>
              <ul>
                {quickLinks.map(({ label, href, Icon }) => (
                  <li key={href}>
                    <Link href={href}>
                      <span className="inner-quick-links-icon" aria-hidden>
                        <Icon />
                      </span>
                      <span>{label}</span>
                      <ChevronRight aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </QuestionBankFilterDrawer>

          <section className="qb-results" aria-label="Question paper results">
            <QuestionBankSearchBar query={query} />
            <div className="qb-results-card">
              <QuestionBankResultsHeader
                query={query}
                total={total}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
              />
              {result && result.items.length ? (
                <ol className="qb-list">
                  {result.items.map((paper) => (
                    <QuestionPaperCard
                      key={paper.id || paper.slug}
                      paper={paper}
                      downloadMode={result.downloadMode}
                    />
                  ))}
                </ol>
              ) : (
                <QuestionBankEmptyState hasFilters={hasFilters} unavailable={!result} />
              )}
              <Pagination
                page={page}
                pageCount={result?.pageCount ?? 1}
                hrefForPage={(nextPage) => qbHref(query, { page: String(nextPage) })}
                label="Question paper pages"
              />
            </div>
          </section>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </main>
  );
}
