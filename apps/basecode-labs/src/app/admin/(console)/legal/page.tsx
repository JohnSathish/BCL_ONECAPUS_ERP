import { prisma } from '@/lib/prisma';
import { ensureLegalDocuments, listLegalDocuments } from '@/lib/legal';

export const dynamic = 'force-dynamic';

function formatDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

type AdminLegalDoc = {
  id: string;
  slug: string;
  title: string;
  version: string;
  status: string;
  versions: Array<{
    id: string;
    version: string;
    publishedAt: Date;
    changeSummary: string;
    contentHtml: string;
  }>;
  acceptances: number;
};

export default async function LegalAdminPage() {
  let docs: AdminLegalDoc[] = [];
  try {
    await ensureLegalDocuments();
    const rows = await prisma.legalDocument.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        versions: { orderBy: { publishedAt: 'desc' } },
        _count: { select: { acceptances: true } },
      },
    });
    docs = rows.map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      version: d.version,
      status: d.status,
      versions: d.versions,
      acceptances: d._count.acceptances,
    }));
  } catch (err) {
    console.error('[legal] admin list failed', err);
  }
  if (!docs.length) {
    const fallback = await listLegalDocuments();
    docs = fallback.map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      version: d.version,
      status: d.status,
      versions: d.versions ?? [],
      acceptances: 0,
    }));
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Legal documents</h1>
      <p className="mt-1 text-sm text-slate-600">
        Published policies and previous versions. Missing records are created from the bundled
        company policies on load.
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
              Version {d.version} · {d.acceptances} recorded acceptances
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              {d.versions.map((v) => (
                <li key={v.id}>
                  <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer font-medium text-slate-700">
                      v{v.version} · {formatDay(v.publishedAt)} · {v.changeSummary}
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
