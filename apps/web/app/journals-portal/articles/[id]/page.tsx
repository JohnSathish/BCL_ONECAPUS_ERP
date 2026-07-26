import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ArticleDetailClient } from '@/components/journals-portal/article-detail-client';
import { unwrapApiPayload } from '@/lib/http/api-envelope';
import { JOURNALS_PUBLIC_URL } from '@/lib/journals-host';

const API_BASE = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001/api';

type ArticleMeta = {
  id: string;
  title: string;
  abstract: string | null;
  doi: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  pageRange: string | null;
  keywords?: string[];
  authors?: Array<{ fullName: string }>;
  issue?: { volume?: { year?: number }; publicationDate?: string | null };
};

async function loadArticle(id: string): Promise<ArticleMeta | null> {
  const h = await headers();
  const host =
    h.get('x-forwarded-host') ||
    h.get('host') ||
    process.env.NEXT_PUBLIC_JOURNALS_HOST ||
    'transient.demo.localhost';
  const slug = h.get('x-journal-slug') || process.env.NEXT_PUBLIC_JOURNAL_SLUG || 'transient';
  try {
    const res = await fetch(`${API_BASE}/v1/journals/portal/articles/${id}`, {
      headers: {
        'X-Login-Host': host.split(':')[0]!,
        'X-Forwarded-Host': host.split(':')[0]!,
        'X-Journal-Slug': slug,
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return unwrapApiPayload<ArticleMeta>(await res.json());
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) {
    return { title: 'Article | Journal Portal' };
  }
  const authors = (article.authors ?? []).map((a) => a.fullName);
  const year =
    article.issue?.volume?.year ||
    (article.publishedAt ? new Date(article.publishedAt).getFullYear() : undefined);
  const description = article.abstract?.slice(0, 160) || article.title;
  const url = `${JOURNALS_PUBLIC_URL.replace(/\/$/, '')}/articles/${article.id}`;

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      url,
      type: 'article',
      publishedTime: article.publishedAt || undefined,
    },
    other: {
      citation_title: article.title,
      citation_publication_date: article.publishedAt
        ? article.publishedAt.slice(0, 10)
        : year
          ? String(year)
          : '',
      ...(article.doi ? { citation_doi: article.doi } : {}),
      ...(article.pdfUrl ? { citation_pdf_url: article.pdfUrl } : {}),
      ...(article.pageRange ? { citation_firstpage: article.pageRange.split('-')[0]! } : {}),
      ...(authors[0] ? { citation_author: authors[0] } : {}),
      citation_journal_title: 'Journal',
      citation_language: 'en',
    },
  };
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await loadArticle(id);
  const authors = article?.authors ?? [];
  const year =
    article?.issue?.volume?.year ||
    (article?.publishedAt ? new Date(article.publishedAt).getFullYear() : undefined);

  return (
    <>
      {article ? (
        <>
          {authors.map((a, i) => (
            <meta key={`ca-${i}`} name="citation_author" content={a.fullName} />
          ))}
          <meta name="citation_title" content={article.title} />
          {year ? <meta name="citation_publication_date" content={String(year)} /> : null}
          {article.doi ? <meta name="citation_doi" content={article.doi} /> : null}
          {article.pdfUrl ? <meta name="citation_pdf_url" content={article.pdfUrl} /> : null}
          {article.abstract ? (
            <meta name="description" content={article.abstract.slice(0, 300)} />
          ) : null}
        </>
      ) : null}
      <ArticleDetailClient articleId={id} />
    </>
  );
}
