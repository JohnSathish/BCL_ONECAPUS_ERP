'use client';

import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
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
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">Resources</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">Downloads</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#0A2342]/65">
          Volume archives, forms, and other downloadable materials.
        </p>
        {downloadsQ.isLoading ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">
            Downloads will appear here once published by the editorial office.
          </p>
        ) : (
          <div className="mt-10 space-y-10">
            {categories.map((cat) => {
              const list = rows.filter((r) => r.category === cat);
              if (!list.length) return null;
              return (
                <section key={cat}>
                  <h2 className="border-b border-[#F4B400]/40 pb-2 font-serif text-xl font-semibold text-[#0A2342]">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {list.map((d) => (
                      <li key={d.id}>
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 rounded-lg border border-[#0A2342]/10 bg-white px-4 py-3 text-sm shadow-sm hover:border-[#F4B400]/50"
                        >
                          <span className="font-medium text-[#0A2342]">{d.title}</span>
                          <span className="text-xs text-[#0A2342]/50">
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
