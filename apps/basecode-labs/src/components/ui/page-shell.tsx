import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BarChart3, Shield, Users, Zap } from 'lucide-react';
import { COMPANY } from '@/lib/company';

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="bcl-container py-12 lg:py-16">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-[2.6rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">{description}</p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}

export function SiteCta({
  title = 'Ready to build what’s next?',
  description = 'Tell us about your school, college or organisation. We typically respond within 24 hours.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-[#05142c] via-[#0a3d82] to-[#0b5ea8] py-12 text-white lg:py-16">
      <div className="grid-glow pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-12 lg:px-6">
        <div className="lg:col-span-5">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
            Let’s work together
            <span className="h-px w-10 bg-cyan-400/80" />
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            {title === 'Ready to build what’s next?' ? (
              <>
                Ready to build <span className="text-cyan-300">what’s next?</span>
              </>
            ) : (
              title
            )}
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-7 text-slate-200">{description}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/contact" className="bcl-btn bcl-btn-accent gap-2">
              Start a Project
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={`mailto:${COMPANY.email}`}
              className="bcl-btn border border-white/25 bg-white/5 text-white"
            >
              Talk to BaseCode Labs
            </a>
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-4">
          {[
            { icon: Zap, title: 'Quick Response', copy: 'Within 24 hours' },
            { icon: Users, title: 'Expert Team', copy: 'Technology & Education' },
            { icon: Shield, title: 'Trusted Partner', copy: 'Long-term Support' },
            { icon: BarChart3, title: 'Practical Solutions', copy: 'Real Impact' },
          ].map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-cyan-200">
                <item.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="text-xs text-slate-300">{item.copy}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="relative mx-auto hidden w-full max-w-sm lg:col-span-3 lg:block">
          <Image
            src="/images/products/erp-laptop.png"
            alt="BaseCode Labs software on a laptop"
            width={480}
            height={320}
            className="relative z-10 h-auto w-full rounded-lg object-contain opacity-95 drop-shadow-2xl"
          />
          <p className="pointer-events-none absolute right-2 top-6 max-w-[7rem] text-right text-[11px] font-semibold uppercase leading-4 tracking-[0.18em] text-white/80">
            Ideas
            <br />
            Technology
            <br />
            People
            <br />
            Impact
          </p>
        </div>
      </div>
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function LegalDoc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main>
      <PageHero eyebrow="Legal" title={title} />
      <div className="bcl-container py-12">
        <div className="mx-auto max-w-3xl text-[15px] leading-7 text-slate-600">{children}</div>
      </div>
    </main>
  );
}
