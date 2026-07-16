'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
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
      <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
        {articleQ.isLoading ? (
          <p className="text-sm text-[#0A2342]/60">Loading…</p>
        ) : !article ? (
          <p className="text-sm text-red-700">Article not found.</p>
        ) : (
          <>
            {article.category ? (
              <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">
                {article.category}
              </p>
            ) : null}
            <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">
              {article.title}
            </h1>
            <p className="mt-3 text-sm text-[#0A2342]/70">
              {(article.authors ?? []).map((a) => a.fullName).join(', ')}
            </p>
            {article.doi ? (
              <p className="mt-1 text-xs text-[#0A2342]/55">DOI: {article.doi}</p>
            ) : null}
            {article.pageRange ? (
              <p className="mt-1 text-xs text-[#0A2342]/50">pp. {article.pageRange}</p>
            ) : null}
            {article.abstract ? (
              <div className="mt-8 rounded-lg border border-[#0A2342]/10 bg-[#f7f8fa] p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0A2342]/55">
                  Abstract
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#0A2342]/85">{article.abstract}</p>
              </div>
            ) : null}
            {article.keywords?.length ? (
              <p className="mt-4 text-xs text-[#0A2342]/60">
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
                  className="rounded-md bg-[#F4B400] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0A2342]"
                >
                  Download PDF
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void onCite('csl')}
                className="rounded-md border border-[#0A2342]/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0A2342]"
              >
                Cite CSL
              </button>
              <button
                type="button"
                onClick={() => void onCite('ris')}
                className="rounded-md border border-[#0A2342]/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0A2342]"
              >
                Cite RIS
              </button>
              <button
                type="button"
                onClick={() => void onCite('crossref-xml')}
                className="rounded-md border border-[#0A2342]/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0A2342]"
              >
                Crossref XML
              </button>
            </div>
            {citeMsg ? <p className="mt-2 text-xs text-[#0A2342]/60">{citeMsg}</p> : null}
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
