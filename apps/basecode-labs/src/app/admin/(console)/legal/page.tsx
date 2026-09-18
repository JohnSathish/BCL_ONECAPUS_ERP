import { prisma } from '@/lib/prisma';

export default async function LegalAdminPage() {
  const docs = await prisma.legalDocument.findMany({
    orderBy: { displayOrder: 'asc' },
    include: {
      versions: { orderBy: { publishedAt: 'desc' } },
      _count: { select: { acceptances: true } },
    },
  });
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Legal documents</h1>
      <p className="mt-1 text-sm text-slate-600">
        Published policies and previous versions. Seed does not overwrite existing documents.
      </p>
      <ul className="mt-6 space-y-4">
        {docs.map((d) => (
          <li key={d.id} className="bcl-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                {d.title} <span className="text-xs font-normal text-slate-500">/{d.slug}</span>
              </h2>
              <span className="bcl-badge bg-emerald-50 text-emerald-700">{d.status}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Version {d.version} · {d._count.acceptances} recorded acceptances
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              {d.versions.map((v) => (
                <li key={v.id}>
                  <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer font-medium text-slate-700">
                      v{v.version} · {v.publishedAt.toLocaleDateString('en-IN')} · {v.changeSummary}
                    </summary>
                    <div className="legal-body mt-3 max-h-80 overflow-auto rounded-lg bg-white p-3 text-xs">
                      <div dangerouslySetInnerHTML={{ __html: v.contentHtml }} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
