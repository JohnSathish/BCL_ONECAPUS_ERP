'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Clock, Headset, Mail, Phone, Quote } from 'lucide-react';
import { PoweredByBaseCodeLabs } from '@/components/branding/powered-by-basecode-labs';
import {
  SCHOOL_PORTAL_BUILDING_SRC,
  SCHOOL_PORTAL_LOGO_SRC,
} from '@/lib/school-admissions-branding';
import { fetchSchoolPortalInfo } from '@/services/school-admissions';
import './school-portal.css';

function useSchoolPortalFavicon() {
  useEffect(() => {
    const href = SCHOOL_PORTAL_LOGO_SRC;
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='shortcut icon']"),
    );
    if (!links.length) {
      const link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
      links.push(link);
    }
    for (const link of links) {
      link.type = 'image/png';
      link.href = href;
    }
  }, []);
}

export function useSchoolPortalBranding() {
  const info = useQuery({ queryKey: ['school-admissions-info'], queryFn: fetchSchoolPortalInfo });
  return {
    info,
    schoolName: info.data?.branding?.displayName ?? 'Tura Public School, Tura',
    shortName: info.data?.branding?.shortName ?? 'TPS Tura',
    subtitle: info.data?.branding?.portalSubtitle ?? 'K.G. Admission — Academic Session 2027',
    helpPhone: info.data?.settings?.helpDesk?.phone || '',
    helpEmail: info.data?.settings?.helpDesk?.email || 'info@turapublicschool.com',
  };
}

export function SchoolBrandBar({
  schoolName,
  shortName,
  subtitle,
}: {
  schoolName: string;
  shortName: string;
  subtitle: string;
}) {
  return (
    <header className="relative overflow-hidden bg-[#1a5336] text-white">
      <div className="relative z-10 mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
        <img
          src={SCHOOL_PORTAL_LOGO_SRC}
          alt={schoolName}
          width={72}
          height={90}
          className="h-14 w-auto shrink-0 sm:h-16"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
            {shortName}
          </p>
          <h1 className="tps-serif text-lg font-semibold leading-tight sm:text-2xl">
            {schoolName}
          </h1>
          <p className="text-xs text-emerald-100/90 sm:text-sm">{subtitle}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] md:block">
        <img
          src={SCHOOL_PORTAL_BUILDING_SRC}
          alt=""
          className="h-full w-full object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#1a5336]/25 to-[#1a5336]" />
        <p className="tps-script absolute right-6 top-5 text-2xl text-white drop-shadow">
          Nurturing Bright Futures
        </p>
      </div>
    </header>
  );
}

export function SchoolPortalFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} Tura Public School, Tura. Affiliated to CISCE, New Delhi.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link className="text-[#1a5336] underline" href="https://turapublicschool.com/">
            turapublicschool.com
          </Link>
          <PoweredByBaseCodeLabs className="text-[#1a5336] underline" />
        </div>
      </div>
    </footer>
  );
}

export function SchoolNeedHelpCard({ phone, email }: { phone?: string; email?: string }) {
  const deskEmail = email || 'info@turapublicschool.com';
  const deskPhone = phone?.trim() || '';
  return (
    <aside className="tps-public-aside">
      <p className="flex items-center gap-2 font-semibold text-[#1a5336]">
        <Headset className="h-4 w-4" />
        Need help?
      </p>
      <p className="mt-2 text-slate-600">Admission office, Tura Public School</p>
      {deskPhone ? (
        <p className="mt-2 flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-[#1a5336]" />
          {deskPhone}
        </p>
      ) : null}
      <p className="mt-1 flex items-center gap-2 break-all">
        <Mail className="h-3.5 w-3.5 shrink-0 text-[#1a5336]" />
        {deskEmail}
      </p>
      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <Clock className="h-3.5 w-3.5 text-[#1a5336]" />
        Weekdays 10:30 AM – 2:00 PM
      </p>
    </aside>
  );
}

export function SchoolQuoteCard({ children, by }: { children: string; by: string }) {
  return (
    <aside className="tps-public-aside">
      <Quote className="h-7 w-7 text-[#1a5336]/75" />
      <p className="mt-2 italic leading-relaxed text-slate-700">“{children}”</p>
      <p className="mt-2 text-xs font-medium text-[#1a5336]">— {by}</p>
    </aside>
  );
}

export function SchoolEligibilityCard() {
  return (
    <aside className="rounded-2xl border border-amber-200 bg-[#fff4d6] p-4 text-sm text-amber-950">
      <p className="font-semibold">Important information</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>
          Age as on 1st January 2027: <strong>At least 5 years and not more than 6 years.</strong>
        </li>
        <li>The child must have attended Nursery.</li>
        <li>Names must match the original birth and caste certificates.</li>
      </ul>
    </aside>
  );
}

export function SchoolAdmissionsShell({
  children,
  variant = 'app',
}: {
  children: React.ReactNode;
  variant?: 'app' | 'public';
}) {
  useSchoolPortalFavicon();
  const branding = useSchoolPortalBranding();

  if (variant === 'public') {
    return <div className="tps-portal min-h-screen text-slate-900">{children}</div>;
  }

  return (
    <div className="tps-portal flex min-h-screen flex-col bg-[#f4f6f5] text-slate-900">
      <SchoolBrandBar
        schoolName={branding.schoolName}
        shortName={branding.shortName}
        subtitle={branding.subtitle}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <SchoolPortalFooter />
    </div>
  );
}
