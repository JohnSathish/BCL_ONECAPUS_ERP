'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

export const ADMISSIONS_COLLEGE_LOGO = '/branding/college-logo.png';

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

/** Centered solid/dotted background shell (no campus photo panel). */
export function AdmissionsAuthLayout({
  collegeName: _collegeName,
  portalSubtitle: _portalSubtitle,
  logoUrl: _logoUrl,
  children,
  admissionsOpen = true,
  openMessage,
}: AuthLayoutProps) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[#e8f0fe] px-4 py-10"
      style={{
        backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="relative w-full max-w-[440px] space-y-4">
        {admissionsOpen === false ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-950">
            {openMessage || 'Online admissions are currently closed.'}
          </div>
        ) : null}
        {children}
      </div>
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
        'rounded-2xl border border-slate-200/80 bg-white p-7 shadow-2xl sm:p-8',
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
          width={80}
          height={80}
          className="h-20 w-20 object-contain"
          unoptimized
        />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-[#1a2b4b]">{collegeName}</h1>
      {portalSubtitle ? <p className="mt-0.5 text-sm text-slate-500">{portalSubtitle}</p> : null}
      <h2 className="mt-6 text-lg font-bold text-[#1a2b4b]">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
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
