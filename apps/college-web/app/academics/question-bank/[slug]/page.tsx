import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, CalendarDays, Download, FileText, GraduationCap } from 'lucide-react';
import { InnerPageShell } from '@/components/inner-page-shell';
import { siteUrl } from '@/lib/content';
import {
  QUESTION_BANK_PATH,
  QUESTION_BANK_TITLE,
  formatFileSize,
  formatQbDate,
  getQuestionPaper,
  paperHeading,
  qbDownloadHref,
  qbPaperHref,
} from '@/lib/question-bank';

type Props = { params: Promise<{ slug: string }> };

function describe(paper: NonNullable<Awaited<ReturnType<typeof getQuestionPaper>>>) {
  const parts = [
    paper.examType?.label,
    'question paper',
    paper.programme ? `for ${paper.programme.label}` : null,
    paper.semester ? `Semester ${paper.semester}` : null,
    paper.academicYear ? `(${paper.academicYear.label})` : null,
  ].filter(Boolean);
  return `${paperHeading(paper)} — ${parts.join(' ')}. Previous question paper from Don Bosco College, Tura.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const paper = await getQuestionPaper(slug);
  if (!paper) return { title: 'Question Paper', robots: { index: false, follow: true } };
  const title = `${paperHeading(paper)}${paper.examYear ? ` (${paper.examYear})` : ''} – Question Paper`;
  const description = describe(paper);
  return {
    title,
    description,
    alternates: { canonical: qbPaperHref(paper.slug) },
    openGraph: { title, description, url: qbPaperHref(paper.slug), type: 'article' },
  };
}

export default async function QuestionPaperDetailPage({ params }: Props) {
  const { slug } = await params;
  const paper = await getQuestionPaper(slug);
  if (!paper) notFound();

  const heading = paperHeading(paper);
  const size = formatFileSize(paper.fileBytes);
  const newTab = paper.downloadMode === 'NEW_TAB';
  const rows: Array<[string, string | null | undefined]> = [
    ['Subject', paper.subjectName || paper.subject?.label],
    ['Subject Code', paper.subjectCode],
    ['Programme', paper.programme?.label],
    ['Department', paper.department?.label],
    ['Major', paper.major?.label],
    ['Semester', paper.semester ? `Semester ${paper.semester}` : null],
    ['Academic Year', paper.academicYear?.label],
    ['Examination Type', paper.examType?.label],
    ['Examination Year', paper.examYear ? String(paper.examYear) : null],
    ['Published Date', formatQbDate(paper.publishedAt)],
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    name: heading,
    description: describe(paper),
    url: `${siteUrl}${qbPaperHref(paper.slug)}`,
    encodingFormat: 'application/pdf',
    datePublished: paper.publishedAt ?? undefined,
    dateModified: paper.updatedAt,
    inLanguage: 'en',
    publisher: { '@type': 'CollegeOrUniversity', name: 'Don Bosco College Tura', url: siteUrl },
  };

  return (
    <InnerPageShell
      title={heading}
      eyebrow="Question Bank"
      lead={paper.title !== heading ? paper.title : null}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Academics' },
        { label: 'Question Bank', href: QUESTION_BANK_PATH },
        { label: paper.subjectCode || paper.title },
      ]}
      quickLinks={[
        { label: QUESTION_BANK_TITLE, href: QUESTION_BANK_PATH, Icon: FileText },
        { label: 'Departments', href: '/departments', Icon: GraduationCap },
        { label: 'Programmes', href: '/academics/programmes', Icon: BookOpen },
        { label: 'Academic Calendar', href: '/academics/calendar', Icon: CalendarDays },
      ]}
      showQuoteCard={false}
    >
      <div className="qb-detail">
        <dl className="qb-detail-grid">
          {rows
            .filter(([, value]) => value && value !== '—')
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>

        {paper.description ? (
          <div className="qb-detail-description">
            {paper.description.split(/\n{2,}/).map((para, index) => (
              <p key={index}>{para}</p>
            ))}
          </div>
        ) : null}

        <div className="qb-detail-actions">
          <a
            className="qb-button qb-button-primary qb-download"
            href={qbDownloadHref(paper.slug)}
            {...(newTab ? { target: '_blank', rel: 'noopener' } : { download: '' })}
            aria-label={`Download PDF: ${heading}${size ? ` (${size})` : ''}${
              newTab ? ', opens in a new tab' : ''
            }`}
          >
            <Download aria-hidden />
            <span>
              Download PDF
              {size ? <small>({size})</small> : null}
            </span>
          </a>
          <Link className="qb-back-link" href={QUESTION_BANK_PATH}>
            <ArrowLeft aria-hidden /> Back to Question Bank
          </Link>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </InnerPageShell>
  );
}
