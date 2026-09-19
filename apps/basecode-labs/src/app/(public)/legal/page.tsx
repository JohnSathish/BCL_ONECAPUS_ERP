import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { listLegalDocuments } from '@/lib/legal';
import { LegalArticleFrame, LegalIcon, LegalReviewBanner } from '@/components/legal/legal-ui';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Legal & Policies | BaseCode Labs Pvt. Ltd.' },
  description:
    'Transparency, privacy and clear terms for BaseCode Labs websites, software, applications and services.',
  openGraph: {
    title: 'Legal & Policies | BaseCode Labs Pvt. Ltd.',
    description: 'Policies governing BaseCode Labs websites, software, applications and services.',
  },
  alternates: { canonical: '/legal' },
};

export default async function LegalHubPage() {
  const docs = await listLegalDocuments();
  return (
    <LegalArticleFrame title="Legal & Policies">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        <p className="max-w-2xl text-[15px] leading-7 text-slate-600">
          Transparency, privacy and clear terms are important to us. Find the policies governing
          your use of BaseCode Labs websites, software, applications and services.
        </p>
        <div className="mt-4">
          <LegalReviewBanner />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => (
            <Link key={doc.id} href={`/legal/${doc.slug}`} className="bcl-card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <LegalIcon name={doc.icon} className="h-5 w-5" />
                </span>
                <span className="bcl-badge bg-emerald-50 text-emerald-700">Active</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">{doc.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{doc.shortDescription}</p>
              <p className="mt-3 text-xs text-slate-500">
                Last updated{' '}
                {doc.lastUpdated.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                · Version {doc.version}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
                Read Policy <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </LegalArticleFrame>
  );
}
