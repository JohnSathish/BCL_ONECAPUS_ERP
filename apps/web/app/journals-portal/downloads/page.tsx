'use client';

import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchJournalDownloads } from '@/services/journals-portal';

const CATEGORY_LABELS: Record<string, string> = {
  CURRENT_ISSUE: 'Current issue',
  VOLUME_PDF: 'Volume PDFs',
  GUIDELINE: 'Guidelines',
  TEMPLATE: 'Templates',
  FORM: 'Forms',
  OTHER: 'Other',
};

export default function DownloadsPage() {
  const downloadsQ = useQuery({
    queryKey: ['journal-downloads'],
    queryFn: () => fetchJournalDownloads(),
  });
  const rows = downloadsQ.data ?? [];
  const categories = Object.keys(CATEGORY_LABELS);

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="Resources"
        title="Downloads"
        subtitle="Volume archives, forms, templates, and other downloadable materials."
      />
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        {downloadsQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--jp-muted)]">
            Downloads will appear here once published by the editorial office.
          </p>
        ) : (
          <div className="space-y-10">
            {categories.map((cat) => {
              const list = rows.filter((r) => r.category === cat);
              if (!list.length) return null;
              return (
                <section key={cat}>
                  <h2 className="border-b border-[rgba(201,162,39,0.4)] pb-2 jp-serif text-xl font-semibold text-[var(--jp-ink)]">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {list.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--jp-border)] bg-[var(--jp-card)] px-4 py-3 text-sm shadow-sm hover:border-[rgba(201,162,39,0.5)]"
                        >
                          <span className="font-medium text-[var(--jp-ink)]">{d.title}</span>
                          <span className="text-xs text-[var(--jp-muted)]">
                            {d.fileName || 'Download'} →
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </JournalPublicShell>
  );
}
