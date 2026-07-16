'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Building2,
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  Navigation,
  Phone,
  Send,
  UserRound,
} from 'lucide-react';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { FadeUp } from '@/components/journals-portal/home/home-motion';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchJournalPortalInfo } from '@/services/journals-portal';

const CHANNELS = [
  {
    key: 'email',
    label: 'Editorial email',
    icon: Mail,
    hint: 'Primary channel for manuscript queries',
  },
  {
    key: 'phone',
    label: 'Phone desk',
    icon: Phone,
    hint: 'Weekdays · office hours',
  },
  {
    key: 'visit',
    label: 'Campus visit',
    icon: MapPin,
    hint: 'Don Bosco College, Tura',
  },
] as const;

const SUBJECTS = [
  'Manuscript status',
  'Peer review query',
  'Submission guidance',
  'Editorial board',
  'Other',
] as const;

export function ContactView() {
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
    staleTime: 60_000,
  });
  const journal = infoQ.data?.journal;
  const email = journal?.contactEmail || 'transient@donboscocollege.ac.in';
  const phone = journal?.contactPhone || '+91 96128 12345';
  const institution = journal?.institution || 'Don Bosco College, Tura';

  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>('Manuscript status');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const mailtoHref = useMemo(() => {
    const body = [
      name ? `Name: ${name}` : null,
      '',
      message || 'Write your message here…',
      '',
      '— Sent via Transient Contact',
    ]
      .filter((line) => line !== null)
      .join('\n');
    return `mailto:${email}?subject=${encodeURIComponent(`[Transient] ${subject}`)}&body=${encodeURIComponent(body)}`;
  }, [email, subject, name, message]);

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="Journal"
        title="Contact"
        subtitle={`Reach the Transient team for academic correspondence, submission questions, and editorial support — a peer-reviewed annual journal from ${institution}.`}
      />

      <section className="relative bg-[var(--jp-bg)]">
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {CHANNELS.map((ch, i) => {
              const Icon = ch.icon;
              const value = ch.key === 'email' ? email : ch.key === 'phone' ? phone : institution;
              const href =
                ch.key === 'email'
                  ? `mailto:${email}`
                  : ch.key === 'phone'
                    ? `tel:${phone.replace(/\s+/g, '')}`
                    : '/journals-portal/about';
              return (
                <FadeUp key={ch.key} delay={0.06 * (i + 1)}>
                  <a
                    href={href}
                    className="jp-contact-channel group flex h-full flex-col rounded-2xl border border-[var(--jp-border)] bg-[var(--jp-navy)] p-5 text-white transition hover:border-[#C9A227]/55"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#C9A227]/35 bg-[#C9A227]/12 text-[#E4BC3A]">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      {ch.label}
                    </p>
                    <p className="mt-1.5 break-all text-sm font-medium text-white group-hover:text-[#E4BC3A]">
                      {value}
                    </p>
                    <p className="mt-2 text-xs text-white/50">{ch.hint}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E4BC3A]">
                      Connect
                      <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </a>
                </FadeUp>
              );
            })}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-5 lg:gap-10 lg:py-16">
          <FadeUp className="lg:col-span-3">
            <div className="jp-contact-panel overflow-hidden rounded-2xl border border-[var(--jp-border)] bg-[var(--jp-card)] shadow-[0_24px_60px_rgba(11,31,58,0.08)]">
              <div className="border-b border-[var(--jp-border)] bg-[var(--jp-navy)] px-6 py-5 text-white sm:px-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E4BC3A]">
                  Secure channel
                </p>
                <h2 className="jp-serif mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Write to Transient
                </h2>
                <p className="mt-2 text-sm text-white/65">
                  Compose a message — we open your email client with the right subject line.
                </p>
              </div>

              <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--jp-muted)]">
                    Topic
                  </label>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {SUBJECTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSubject(s)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                          subject === s
                            ? 'border-[#C9A227] bg-[rgba(201,162,39,0.12)] text-[var(--jp-ink)]'
                            : 'border-[var(--jp-border)] text-[var(--jp-muted)] hover:border-[var(--jp-ink)]/25'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="jp-contact-name"
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--jp-muted)]"
                  >
                    Your name
                  </label>
                  <input
                    id="jp-contact-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Ada Lovelace"
                    className="mt-2 w-full rounded-xl border border-[var(--jp-border)] bg-transparent px-4 py-3 text-sm text-[var(--jp-ink)] outline-none transition focus:border-[#C9A227]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="jp-contact-message"
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--jp-muted)]"
                  >
                    Message
                  </label>
                  <textarea
                    id="jp-contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Tell us how we can help…"
                    className="mt-2 w-full resize-y rounded-xl border border-[var(--jp-border)] bg-transparent px-4 py-3 text-sm text-[var(--jp-ink)] outline-none transition focus:border-[#C9A227]"
                  />
                </div>

                <a
                  href={mailtoHref}
                  className="jp-btn jp-btn-gold inline-flex items-center gap-2 rounded-sm px-5 py-3"
                >
                  <Send className="h-4 w-4" />
                  Open email to editorial office
                </a>
              </div>
            </div>
          </FadeUp>

          <div className="flex flex-col gap-4 lg:col-span-2">
            <FadeUp delay={0.08}>
              <aside className="jp-contact-panel rounded-2xl border border-[var(--jp-border)] bg-[var(--jp-card)] p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--jp-navy)] text-[#E4BC3A]">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jp-muted)]">
                      Academic correspondence
                    </p>
                    <p className="jp-serif text-lg font-semibold text-[var(--jp-ink)]">
                      Editorial desk
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-1.5 text-sm leading-relaxed text-[var(--jp-ink)]/80">
                  <p className="font-semibold text-[var(--jp-ink)]">Dr. Yubaraj Sharma</p>
                  <p>Chief Editor, Transient</p>
                  <p className="pt-2">{institution}</p>
                  <p>794002, Meghalaya, India</p>
                </div>
                <a
                  href={`mailto:${email}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#B8860B] underline-offset-4 hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  {email}
                </a>
              </aside>
            </FadeUp>

            <FadeUp delay={0.12}>
              <aside className="jp-contact-map relative overflow-hidden rounded-2xl border border-[var(--jp-border)] bg-[var(--jp-navy)] p-6 text-white">
                <div className="jp-contact-map-grid" aria-hidden />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-[#E4BC3A]">
                    <Navigation className="h-4 w-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                      Location lock
                    </p>
                  </div>
                  <p className="jp-serif mt-3 text-2xl font-semibold">Tura · Meghalaya</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    {institution}
                    <br />
                    West Garo Hills · PIN 794002 · India
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/60">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-[#E4BC3A]" />
                      College campus
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-[#E4BC3A]" />
                      Mon–Fri response window
                    </span>
                  </div>
                </div>
                <div className="jp-contact-pulse" aria-hidden />
              </aside>
            </FadeUp>

            <FadeUp delay={0.16}>
              <aside className="rounded-2xl border border-[rgba(201,162,39,0.35)] bg-[rgba(201,162,39,0.08)] p-5">
                <div className="flex gap-3">
                  <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-[#B8860B]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--jp-ink)]">Ready to submit?</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--jp-muted)]">
                      Use Author Desk for manuscripts. Contact is for editorial queries only.
                    </p>
                    <Link
                      href="/journals-portal/author"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--jp-ink)]"
                    >
                      Open Author Desk
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </aside>
            </FadeUp>
          </div>
        </div>
      </section>
    </JournalPublicShell>
  );
}
