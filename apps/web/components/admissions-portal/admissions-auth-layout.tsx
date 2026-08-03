'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Award, GraduationCap, Megaphone, Shield, Users } from 'lucide-react';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

export const ADMISSIONS_CAMPUS_HERO = '/branding/admissions-campus-hero.png';
export const ADMISSIONS_COLLEGE_LOGO = '/branding/college-logo.png';

const VALUE_PROPS = [
  { icon: GraduationCap, label: 'Quality Education' },
  { icon: Shield, label: 'Value Based Learning' },
  { icon: Users, label: 'Holistic Development' },
  { icon: Award, label: 'Bright Future' },
] as const;

function GoldFleur({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block select-none text-[#c9a227]', className)} aria-hidden>
      ❦
    </span>
  );
}

export function resolveAdmissionsLogoUrl(logoUrl?: string | null): string {
  const resolved = logoUrl ? resolveUploadAssetUrl(logoUrl) : undefined;
  if (!resolved) return ADMISSIONS_COLLEGE_LOGO;
  // Prefer the local crest over tiny remote favicons.
  if (/favicon\.ico($|\?)/i.test(resolved)) return ADMISSIONS_COLLEGE_LOGO;
  return resolved;
}

type AuthLayoutProps = {
  collegeName: string;
  portalSubtitle: string;
  logoUrl?: string | null;
  children: React.ReactNode;
  admissionsOpen?: boolean;
  openMessage?: string;
};

export function AdmissionsAuthLayout({
  collegeName,
  portalSubtitle,
  logoUrl,
  children,
  admissionsOpen = true,
  openMessage,
}: AuthLayoutProps) {
  const crest = resolveAdmissionsLogoUrl(logoUrl);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Left — campus brand panel */}
      <aside className="relative hidden min-h-screen overflow-hidden lg:block">
        <Image
          src={ADMISSIONS_CAMPUS_HERO}
          alt=""
          fill
          priority
          className="object-cover object-[center_35%]"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b2545]/55 via-[#0b2545]/35 to-[#0b2545]/78" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),transparent_55%)]" />

        <div className="relative flex h-full min-h-screen flex-col justify-between p-10 text-white xl:p-12">
          <div>
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-white/95 p-1.5 shadow-lg ring-1 ring-white/60">
                <Image
                  src={crest}
                  alt=""
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] object-contain"
                  unoptimized
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white xl:text-3xl">
                  {collegeName}
                </h1>
                <p className="mt-1 text-sm font-medium text-sky-100/90">{portalSubtitle}</p>
              </div>
            </div>
            <div className="mt-5">
              <GoldFleur className="text-xl" />
            </div>

            <div className="mt-10 max-w-md">
              <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                Your Future.
                <br />
                Our Commitment.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/85">
                Begin your academic journey with {collegeName}. Excellence in Education. Values for
                Life.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/15 bg-[#0b2545]/55 p-3 backdrop-blur-md xl:grid-cols-4">
              {VALUE_PROPS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold text-white/95"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Icon className="h-4 w-4 text-[#e4bc3a]" />
                  </span>
                  <span className="leading-snug">{label}</span>
                </div>
              ))}
            </div>

            {admissionsOpen ? (
              <div className="flex items-start gap-3 rounded-full bg-white px-4 py-3 text-sm text-slate-800 shadow-lg">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <Megaphone className="h-4 w-4" />
                </span>
                <p className="pt-1 font-medium leading-snug">
                  {openMessage ||
                    `Admissions Open for ${portalSubtitle.replace(/^Admission Portal\s*/i, 'Academic Year ')}. Apply today and take the first step towards your future.`}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50/95 px-4 py-3 text-sm font-medium text-amber-950">
                {openMessage || 'Online admissions are currently closed.'}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Right — auth card */}
      <section className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-[#e8f1fb] via-[#f3f7fc] to-[#dce9f8] px-4 py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="relative w-full max-w-[440px]">{children}</div>
      </section>
    </div>
  );
}

export function AdmissionsAuthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-white/80 bg-white p-7 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] sm:p-8',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdmissionsAuthCardHeader({
  collegeName,
  portalSubtitle,
  logoUrl,
  title,
  description,
}: {
  collegeName: string;
  portalSubtitle?: string;
  logoUrl?: string | null;
  title: string;
  description: string;
}) {
  const crest = resolveAdmissionsLogoUrl(logoUrl);
  return (
    <div className="text-center">
      <div className="mx-auto w-fit rounded-full bg-white p-1 shadow-md ring-1 ring-slate-100">
        <Image
          src={crest}
          alt={collegeName}
          width={72}
          height={72}
          className="h-[72px] w-[72px] object-contain"
          unoptimized
        />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 lg:hidden">
        {collegeName}
      </p>
      {portalSubtitle ? (
        <p className="mt-0.5 text-xs text-slate-500 lg:hidden">{portalSubtitle}</p>
      ) : null}
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#0b2545]">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
      <div className="mt-3">
        <GoldFleur />
      </div>
    </div>
  );
}

export function AdmissionsHelpDeskBox({ phone, email }: { phone: string; email?: string | null }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
        Admission Help Desk
      </p>
      <p className="mt-1.5 text-sm font-semibold text-[#0b2545]">{phone}</p>
      {email ? (
        <a href={`mailto:${email}`} className="mt-0.5 block text-sm text-blue-700 hover:underline">
          {email}
        </a>
      ) : null}
    </div>
  );
}

export function AdmissionsAuthFooterLinks({
  registerHref = '/admissions-portal/register',
}: {
  registerHref?: string;
}) {
  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-slate-600">
        Don&apos;t have an account?{' '}
        <Link href={registerHref} className="font-semibold text-blue-700 hover:underline">
          Register here
        </Link>
      </p>
      <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-slate-500">
        <Shield className="h-3.5 w-3.5 text-emerald-600" />
        <span>Secure | Trusted | Confidential. Your data is safe with us.</span>
      </div>
    </div>
  );
}
