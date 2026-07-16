'use client';

import Link from 'next/link';
import {
  BookOpen,
  Download,
  FileText,
  FlaskConical,
  Lightbulb,
  PenLine,
  Scale,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { FadeUp } from '@/components/journals-portal/home/home-motion';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';

const CATEGORIES = [
  {
    title: 'Strategy papers',
    detail: 'Strategic perspectives and applied science policy discussions.',
    pages: null as string | null,
    icon: Lightbulb,
  },
  {
    title: 'Review articles',
    detail: 'Critical analysis of science-related topics, written concisely.',
    pages: '~15 pages incl. tables & figures',
    icon: BookOpen,
  },
  {
    title: 'Research papers',
    detail: 'Original research contributions with clear methodology and results.',
    pages: '~10 pages incl. diagrams & tables',
    icon: FlaskConical,
  },
  {
    title: 'Short communications',
    detail: 'Brief reports of significant findings or methods.',
    pages: '~5 pages incl. tables & figures',
    icon: FileText,
  },
  {
    title: 'Maiden reports',
    detail: 'First reports suitable for early or exploratory findings.',
    pages: null,
    icon: PenLine,
  },
] as const;

const STRUCTURE = [
  { label: 'Title', text: 'Running sentence case; capitalise only important words.' },
  {
    label: 'Authors',
    text: 'Full names with affiliations (department, institute, address, country).',
  },
  { label: 'Corresponding author', text: 'One corresponding email address.' },
  { label: 'Abstract', text: '120–250 words; a single paragraph is preferred.' },
  { label: 'Keywords', text: 'Minimum 3 and maximum 5 keywords.' },
  {
    label: 'Body',
    text: 'Introduction · Methodology (with sub-sections as needed) · Results and Conclusion.',
  },
  {
    label: 'Tables',
    text: 'Caption before the table; cite as Table 1, Table 2… Provide data as Excel when possible.',
  },
  {
    label: 'Figures',
    text: 'Caption after the figure; cite as Figure 1… Prefer vectors; rasters ≥ 300 dpi.',
  },
  {
    label: 'Acknowledgement',
    text: 'Grants or contributors who are not listed as authors.',
  },
  { label: 'References', text: 'APA style (IEEE accepted where appropriate); include DOI/ISBN.' },
] as const;

const INSTRUCTIONS = [
  {
    title: 'Scientific names',
    text: 'Scientific names and local/vernacular names must be italicised.',
  },
  {
    title: 'Tables & figures',
    text: 'Number and reference all tables/graphs in the text. Provide them as separate files where possible. Use metric units.',
  },
  {
    title: 'How to submit',
    text: 'Sign in or register on this portal, then use Author Desk → New submission. Upload the manuscript PDF and supporting files. Google Forms are no longer used.',
  },
  {
    title: 'Review process',
    text: 'Editorial screening is followed by peer review. Authors normally have 14 days to return a revised manuscript after reviewer comments.',
  },
  {
    title: 'Final acceptance',
    text: 'The editorial team decides based on reviewer input. Minor grammatical and stylistic edits may be made at proof stage.',
  },
  {
    title: 'Copyright',
    text: 'The publisher reserves copyright to published papers as stated in journal policy.',
  },
] as const;

export function AuthorGuidelinesView() {
  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="For authors"
        title="Author Guidelines"
        actions={
          <>
            <Link
              href="/journals-portal/author/submissions/new"
              className="jp-btn jp-btn-gold inline-flex items-center gap-2 rounded-sm px-5 py-3"
            >
              <Send className="h-4 w-4" />
              Start a new submission
            </Link>
            <Link
              href="/journals-portal/downloads"
              className="jp-btn inline-flex items-center gap-2 rounded-sm border border-white/35 bg-transparent px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/10"
            >
              <Download className="h-4 w-4" />
              Downloads / templates
            </Link>
            <Link
              href="/journals-portal/peer-review"
              className="jp-btn inline-flex items-center gap-2 rounded-sm border border-white/35 bg-transparent px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/10"
            >
              <ShieldCheck className="h-4 w-4" />
              Peer review policy
            </Link>
          </>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-12 lg:px-6 lg:py-16">
        {/* Intro callout */}
        <FadeUp>
          <div className="rounded-lg border border-[rgba(201,162,39,0.35)] bg-[rgba(201,162,39,0.08)] px-5 py-5 sm:px-7 sm:py-6">
            <p className="text-sm leading-relaxed text-[var(--jp-ink)] sm:text-[15px]">
              Prepare your manuscript using the journal template, then submit{' '}
              <strong>online through this portal</strong> (Author Desk → New submission). Former
              Google Forms and Google Sites submission links are discontinued.
            </p>
          </div>
        </FadeUp>

        {/* Categories */}
        <FadeUp className="mt-14">
          <p className="jp-eyebrow">Article types</p>
          <h2 className="jp-serif mt-2 text-3xl font-semibold tracking-tight">
            Article categories
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--jp-muted)]">
            Select one category when submitting. Page limits are suggestive; clarity and
            completeness take priority.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className="jp-lift flex flex-col rounded-lg border border-[var(--jp-border)] bg-[var(--jp-card)] p-5 shadow-sm"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[rgba(201,162,39,0.12)] text-[var(--jp-gold)]">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <h3 className="jp-serif mt-4 text-xl font-semibold">{c.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--jp-muted)]">
                    {c.detail}
                  </p>
                  {c.pages ? (
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--jp-gold)]">
                      {c.pages}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </FadeUp>

        {/* Structure */}
        <FadeUp className="mt-16">
          <p className="jp-eyebrow">Formatting</p>
          <h2 className="jp-serif mt-2 text-3xl font-semibold tracking-tight">
            Manuscript structure
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--jp-muted)]">
            Follow this order in the manuscript PDF.
          </p>
          <ol className="mt-8 space-y-3">
            {STRUCTURE.map((row, i) => (
              <li
                key={row.label}
                className="flex gap-4 rounded-lg border border-[var(--jp-border)] bg-[var(--jp-card)] px-4 py-3.5 sm:px-5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--jp-navy)] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-[var(--jp-ink)]">{row.label}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-[var(--jp-muted)]">
                    {row.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </FadeUp>

        {/* General instructions */}
        <FadeUp className="mt-16">
          <p className="jp-eyebrow">Process</p>
          <h2 className="jp-serif mt-2 text-3xl font-semibold tracking-tight">
            General instructions
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {INSTRUCTIONS.map((item, i) => (
              <div
                key={item.title}
                className="rounded-lg border border-[var(--jp-border)] bg-[var(--jp-paper)] p-5"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--jp-gold)]">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 text-base font-semibold text-[var(--jp-ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--jp-muted)]">{item.text}</p>
              </div>
            ))}
          </div>
        </FadeUp>

        {/* References + disclaimer */}
        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <FadeUp>
            <div className="h-full rounded-lg border border-[var(--jp-border)] bg-[var(--jp-card)] p-6 shadow-sm">
              <div className="flex items-center gap-2 text-[var(--jp-gold)]">
                <BookOpen className="h-5 w-5" strokeWidth={1.5} />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em]">Referencing</p>
              </div>
              <h2 className="jp-serif mt-3 text-2xl font-semibold">Reference writing pattern</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--jp-muted)]">
                The standard style for Transient is{' '}
                <strong className="text-[var(--jp-ink)]">APA</strong>. IEEE may be accepted where
                appropriate to the discipline. Include a DOI (or ISBN for books) wherever available.
                Avoid non-standard references (unpublished work, generic websites) unless essential.
              </p>
            </div>
          </FadeUp>
          <FadeUp delay={0.06}>
            <div className="h-full rounded-lg border border-[var(--jp-border)] bg-[var(--jp-navy)] p-6 text-white">
              <div className="flex items-center gap-2 text-[#E4BC3A]">
                <Scale className="h-5 w-5" strokeWidth={1.5} />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em]">Disclaimer</p>
              </div>
              <h2 className="jp-serif mt-3 text-2xl font-semibold">Publisher notice</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Facts and opinions in the Journal reflect the views of the author(s), not of
                Transient, its Editorial Board, or the Publisher. Transient is not liable for
                consequences arising from use of the published information. Publication does not
                constitute endorsement by the Journal or Publisher.
              </p>
            </div>
          </FadeUp>
        </div>

        {/* Bottom CTA */}
        <FadeUp className="mt-14">
          <div className="flex flex-col items-start justify-between gap-6 rounded-lg border border-[var(--jp-border)] bg-[var(--jp-paper)] px-6 py-8 sm:flex-row sm:items-center sm:px-8">
            <div>
              <h2 className="jp-serif text-2xl font-semibold tracking-tight">Ready to submit?</h2>
              <p className="mt-1 text-sm text-[var(--jp-muted)]">
                Use the Author Desk on this portal — not Google Forms.
              </p>
            </div>
            <Link
              href="/journals-portal/author/submissions/new"
              className="jp-btn jp-btn-gold inline-flex shrink-0 items-center gap-2 rounded-sm px-5 py-3"
            >
              <Send className="h-4 w-4" />
              Go to submission
            </Link>
          </div>
        </FadeUp>
      </div>
    </JournalPublicShell>
  );
}
