'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import {
  fetchArticleCite,
  fetchJournalArticle,
  recordJournalArticleDownload,
  recordJournalArticleView,
} from '@/services/journals-portal';

function downloadBlob(filename: string, content: string | object, mime: string) {
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ArticleDetailClient({ articleId }: { articleId: string }) {
  const [citeMsg, setCiteMsg] = useState('');
  const articleQ = useQuery({
    queryKey: ['journal-article', articleId],
    queryFn: () => fetchJournalArticle(articleId),
    enabled: Boolean(articleId),
  });
  const article = articleQ.data;

  useEffect(() => {
    if (articleId) {
      void recordJournalArticleView(articleId).catch(() => undefined);
    }
  }, [articleId]);

  async function onCite(format: 'csl' | 'ris' | 'crossref-xml') {
    setCiteMsg('');
    try {
      const data = await fetchArticleCite(articleId, format);
      if (format === 'csl') {
        downloadBlob(`${articleId}.csl.json`, data, 'application/json');
      } else if (format === 'ris') {
        downloadBlob(`${articleId}.ris`, String(data), 'application/x-research-info-systems');
      } else {
        downloadBlob(`${articleId}.crossref.xml`, String(data), 'application/xml');
      }
      setCiteMsg(`Downloaded ${format.toUpperCase()} citation.`);
    } catch {
      setCiteMsg('Could not download citation.');
    }
  }

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow={article?.category || 'Article'}
        title={articleQ.isLoading ? 'Loading…' : article?.title || 'Article not found'}
        subtitle={
          article
            ? [
                (article.authors ?? []).map((a) => a.fullName).join(', '),
                article.doi ? `DOI: ${article.doi}` : null,
                article.pageRange ? `pp. ${article.pageRange}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        hideSubtitle={!article}
      />
      <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
        {articleQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : !article ? (
          <p className="text-sm text-red-700">Article not found.</p>
        ) : (
          <>
            {article.abstract ? (
              <div className="rounded-lg border border-[var(--jp-border)] bg-[var(--jp-paper)] p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--jp-muted)]">
                  Abstract
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--jp-ink)]/85">
                  {article.abstract}
                </p>
              </div>
            ) : null}
            {article.keywords?.length ? (
              <p className="mt-4 text-xs text-[var(--jp-muted)]">
                Keywords: {article.keywords.join(', ')}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              {article.pdfUrl ? (
                <a
                  href={article.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() =>
                    void recordJournalArticleDownload(article.id).catch(() => undefined)
                  }
                  className="rounded-md bg-[#C9A227] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0B1F3A]"
                >
                  Download PDF
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void onCite('csl')}
                className="rounded-md border border-[var(--jp-border)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--jp-ink)]"
              >
                Cite CSL
              </button>
              <button
                type="button"
                onClick={() => void onCite('ris')}
                className="rounded-md border border-[var(--jp-border)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--jp-ink)]"
              >
                Cite RIS
              </button>
              <button
                type="button"
                onClick={() => void onCite('crossref-xml')}
                className="rounded-md border border-[var(--jp-border)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--jp-ink)]"
              >
                Crossref XML
              </button>
            </div>
            {citeMsg ? <p className="mt-2 text-xs text-[var(--jp-muted)]">{citeMsg}</p> : null}
            {article.htmlContent ? (
              <div
                className="prose prose-slate mt-10 max-w-none prose-headings:font-serif"
                dangerouslySetInnerHTML={{ __html: article.htmlContent }}
              />
            ) : null}
          </>
        )}
      </div>
    </JournalPublicShell>
  );
}
