'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, FileBadge2, Globe2, ShieldCheck } from 'lucide-react';
import { fetchJournalPortalInfo } from '@/services/journals-portal';

const NAVY = '#0B2545';
const GOLD = '#D4A017';
/** Natural-sciences backdrop (not campus architecture). */
const AUTH_HERO = '/branding/transient-science-hero.png';
const CAMPUS_FALLBACK = '/branding/alumni-campus-hero.png';

function resolveAuthBackdrop(url?: string | null) {
  if (!url || url === CAMPUS_FALLBACK) return AUTH_HERO;
  return url;
}

const HIGHLIGHTS = [
  { icon: ShieldCheck, label: 'Peer Reviewed' },
  { icon: Globe2, label: 'Open Access' },
  { icon: FileBadge2, label: 'DOI Ready' },
  { icon: BookOpen, label: 'Online Submission' },
];

type Props = {
  children: React.ReactNode;
  mode: 'login' | 'register';
};

export function JournalAuthLayout({ children, mode }: Props) {
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
    staleTime: 60_000,
  });
  const journal = infoQ.data?.journal;
  const metrics = infoQ.data?.metrics;
  const issue = infoQ.data?.currentIssue;
  const title = journal?.name || 'Transient';
  const short = journal?.shortName || title;
  const issn = journal?.issn || metrics?.issn;
  const cover = resolveAuthBackdrop(issue?.coverUrl || journal?.bannerUrl);
  const banner = resolveAuthBackdrop(journal?.bannerUrl);

  const stats = [
    { value: `${metrics?.volumeCount || issue?.volume.volumeNumber || 12}+`, label: 'Volumes' },
    { value: `${Math.max(metrics?.articleCount || 0, 4)}+`, label: 'Articles' },
    { value: '100%', label: 'Peer reviewed' },
    { value: issn || '—', label: 'ISSN' },
  ];

  return (
    <section className="jp-auth-shell relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url(${banner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 20%, rgba(212,160,23,0.08), transparent 45%), linear-gradient(180deg, #F7F9FC 0%, #EEF2F7 100%)',
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-10 lg:px-6 lg:py-14">
        {/* Brand panel */}
        <aside className="jp-fade-up relative hidden overflow-hidden rounded-3xl lg:block">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${cover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(160deg, rgba(11,37,69,0.94) 0%, rgba(11,37,69,0.78) 55%, rgba(11,37,69,0.88) 100%)',
            }}
          />
          <div className="relative flex h-full min-h-[640px] flex-col justify-between p-10 text-white">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E4BC3A]">
                {journal?.institution || 'Don Bosco College, Tura'}
              </p>
              <h1 className="jp-serif mt-3 text-5xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-3 max-w-sm text-base text-white/80">
                {journal?.tagline || 'A Journal of Natural Sciences and Allied Subjects'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">
                {issn ? (
                  <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">
                    ISSN {issn}
                  </span>
                ) : null}
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">
                  Peer Reviewed
                </span>
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1">
                  Open Access
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm italic leading-relaxed text-white/85">
                “Advancing research with scientific rigour — without leaving careful work
                unpublished.”
              </p>
              <ul className="mt-8 grid grid-cols-2 gap-3">
                {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-2.5 text-sm backdrop-blur-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#E4BC3A]" strokeWidth={1.75} />
                    <span className="text-white/90">{label}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 grid grid-cols-4 gap-3 border-t border-white/15 pt-6">
                {stats.map((s) => (
                  <div key={s.label}>
                    <p className="jp-serif text-xl font-semibold tracking-tight text-white">
                      {s.value}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/55">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-white/45">
              {mode === 'login'
                ? `Sign in to ${short} to submit and manage manuscripts.`
                : `Join the ${short} author community.`}
            </p>
          </div>
        </aside>

        {/* Form panel */}
        <div className="jp-fade-up jp-fade-up-delay-1 flex items-center">
          <div className="jp-auth-glass w-full rounded-3xl border border-white/60 p-6 shadow-[0_24px_60px_rgba(11,37,69,0.12)] sm:p-8 lg:p-10">
            <div className="mb-7 lg:hidden">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: GOLD }}
              >
                {journal?.institution || 'Don Bosco College, Tura'}
              </p>
              <p className="jp-serif mt-1 text-3xl font-semibold" style={{ color: NAVY }}>
                {title}
              </p>
              {issn ? (
                <p className="mt-1 text-xs font-medium text-[#0B2545]/70">ISSN {issn}</p>
              ) : null}
            </div>
            {children}
            <p className="mt-8 text-center text-xs text-[#0B2545]/70">
              Need help?{' '}
              <Link
                href="/journals-portal/contact"
                className="font-semibold text-[#0B2545] underline-offset-2 hover:underline"
              >
                Contact the editorial office
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuthField({
  id,
  label,
  icon,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[12px] font-semibold text-[#0B2545]">
        {label}
      </label>
      <div
        className={['jp-auth-field relative', icon ? 'has-icon' : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
      >
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#0B2545]/50">
            {icon}
          </span>
        ) : null}
        {children}
      </div>
      {hint ? <p className="text-[11px] text-[#0B2545]/65">{hint}</p> : null}
    </div>
  );
}

export function passwordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { score, label: 'Weak', color: '#b91c1c' };
  if (score === 2) return { score, label: 'Fair', color: '#c2410c' };
  if (score === 3) return { score, label: 'Good', color: '#a16207' };
  return { score, label: 'Strong', color: '#15803d' };
}

export const AUTH_INSTITUTIONS = [
  'Don Bosco College, Tura',
  'North-Eastern Hill University, Shillong',
  'North-Eastern Hill University, Tura Campus',
  'Assam Don Bosco University',
  'IIT Guwahati',
  'Gauhati University',
  'Assam University, Silchar',
  'Tezpur University',
  'Other',
];

export const AUTH_COUNTRIES = [
  'India',
  'Bangladesh',
  'Bhutan',
  'Nepal',
  'Sri Lanka',
  'United States',
  'United Kingdom',
  'Portugal',
  'Germany',
  'Australia',
  'Canada',
  'Japan',
  'Singapore',
  'Other',
];
