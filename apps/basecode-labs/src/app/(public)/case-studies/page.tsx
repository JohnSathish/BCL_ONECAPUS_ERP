import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { EmptyState, PageHero, SiteCta } from '@/components/ui/page-shell';

export const metadata: Metadata = { title: 'Case studies' };

export default async function CaseStudiesPage() {
  const studies = await prisma.caseStudy.findMany({ where: { status: 'PUBLISHED' } });
  return (
    <main>
      <PageHero
        eyebrow="Case studies"
        title="Published outcomes only"
        description="Outcomes are limited to what clients have already stated publicly. We do not invent conversion or traffic figures."
      />
      <div className="bcl-container space-y-6 py-12">
        {studies.length ? (
          studies.map((s) => (
            <article key={s.id} className="bcl-card p-6">
              <h2 className="text-2xl font-semibold">{s.title}</h2>
              <p className="text-sm text-slate-500">{s.clientName}</p>
              {[
                ['Challenge', s.challenge],
                ['Solution', s.solution],
                ['Technology', s.technology],
                ['Implementation', s.implementation],
                ['Result', s.result],
              ].map(([label, copy]) => (
                <div key={label} className="mt-4">
                  <h3 className="font-semibold">{label}</h3>
                  <p className="mt-1 text-slate-600">{copy}</p>
                </div>
              ))}
            </article>
          ))
        ) : (
          <EmptyState
            title="No case studies yet"
            description="Published case studies from BaseCode Central will appear here."
          />
        )}
        <Link href="/contact" className="inline-flex font-semibold text-blue-700">
          Ask for a similar engagement
        </Link>
      </div>
      <SiteCta />
    </main>
  );
}
