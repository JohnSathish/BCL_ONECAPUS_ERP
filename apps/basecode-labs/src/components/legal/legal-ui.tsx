import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Ban,
  Blocks,
  Building2,
  Cloud,
  Cookie,
  Copyright,
  CreditCard,
  FileText,
  Globe,
  Headphones,
  Info,
  KeyRound,
  Lock,
  Receipt,
  ScrollText,
  Shield,
  Smartphone,
  UserRoundCog,
} from 'lucide-react';
import { PolicySwitcher } from '@/components/legal/policy-switcher';
import { LEGAL_REVIEW_NOTE } from '@/lib/legal';
import { COMPANY } from '@/lib/company';
import { cn } from '@/lib/cn';

const ICONS: Record<string, typeof FileText> = {
  Shield,
  ScrollText,
  KeyRound,
  Receipt,
  Cookie,
  Ban,
  Lock,
  Headset: Headphones,
  Globe,
  Copyright,
  Smartphone,
  Cloud,
  CreditCard,
  UserRoundCog,
  Blocks,
  Info,
  Building2,
  FileText,
};

export function LegalIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? FileText;
  return <Icon className={className} />;
}

export function LegalReviewBanner() {
  return <p className="legal-note text-sm leading-6">{LEGAL_REVIEW_NOTE}</p>;
}

export function LegalNav({
  items,
  current,
}: {
  items: { slug: string; title: string }[];
  current: string;
}) {
  return (
    <>
      <PolicySwitcher items={items} current={current} />
      <nav className="hidden lg:block" aria-label="Policies">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Policy</p>
        <ul className="mt-3 space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/legal/${item.slug}`}
                className={cn(
                  'block rounded-lg px-3 py-2',
                  item.slug === current
                    ? 'bg-blue-50 font-semibold text-blue-800'
                    : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function LegalContact({ policyName }: { policyName: string }) {
  const subject = encodeURIComponent(`${policyName} — Policy Enquiry`);
  return (
    <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">Questions about this policy?</p>
      <p className="mt-2">{COMPANY.legalName}</p>
      <p>
        Email:{' '}
        <a className="text-blue-700" href={`mailto:${COMPANY.email}?subject=${subject}`}>
          {COMPANY.email}
        </a>
      </p>
      <p>
        Website:{' '}
        <a className="text-blue-700" href={COMPANY.website}>
          {COMPANY.website}
        </a>
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Suggested subject: {policyName} — Policy Enquiry
      </p>
    </div>
  );
}

export function LegalArticleFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="bg-[#eef3f9]">
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-white via-sky-50 to-indigo-50">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-blue-100" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-40 w-40 rotate-12 rounded-3xl border border-indigo-100" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
            Legal &amp; Policies
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Clear terms. Responsible technology.
          </p>
          <p className="mt-3 text-xs text-slate-500">Last updated: September 2026</p>
        </div>
      </section>
      {children}
    </main>
  );
}
