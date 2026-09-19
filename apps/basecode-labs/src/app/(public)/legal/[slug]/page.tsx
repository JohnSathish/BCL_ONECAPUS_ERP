import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLegalDocument, listLegalDocuments } from '@/lib/legal';
import {
  LegalArticleFrame,
  LegalContact,
  LegalNav,
  LegalReviewBanner,
} from '@/components/legal/legal-ui';
import { CookieSettings } from '@/components/legal/cookie-banner';

type Props = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getLegalDocument(slug);
  if (!doc) return { title: 'Policy' };
  const title = `BaseCode Labs ${doc.title} | BaseCode Labs Pvt. Ltd.`;
  return {
    title: { absolute: title },
    description: doc.shortDescription,
    alternates: { canonical: `/legal/${doc.slug}` },
    openGraph: { title, description: doc.shortDescription },
  };
}

export default async function LegalDocumentPage({ params }: Props) {
  const { slug } = await params;
  const [doc, all] = await Promise.all([getLegalDocument(slug), listLegalDocuments()]);
  if (!doc) notFound();
  return (
    <LegalArticleFrame title={doc.title}>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[240px_1fr] lg:px-6">
        <aside>
          <LegalNav items={all.map((d) => ({ slug: d.slug, title: d.title }))} current={doc.slug} />
        </aside>
        <article>
          <p className="text-sm text-slate-500">
            Version {doc.version} · Status {doc.status} · Effective{' '}
            {doc.effectiveDate.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            · Last updated{' '}
            {doc.lastUpdated.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            · Published by {doc.publishedBy}
          </p>
          <div className="mt-4">
            <LegalReviewBanner />
          </div>
          <div className="legal-body mt-6" dangerouslySetInnerHTML={{ __html: doc.contentHtml }} />
          {doc.slug === 'cookie-policy' ? <CookieSettings /> : null}
          <LegalContact policyName={doc.title} />
          {doc.versions.length ? (
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900">Version history</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {doc.versions.map((v) => (
                  <li key={v.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <strong>Version {v.version}</strong> ·{' '}
                    {v.publishedAt.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    <p className="mt-1 text-slate-500">{v.changeSummary}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </div>
    </LegalArticleFrame>
  );
}
