'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Receipt,
} from 'lucide-react';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';
import { fetchSchoolApplicantMe } from '@/services/school-admissions';
import { SchoolAdmissionsShell } from './school-admissions-shell';

const LINKS = [
  { href: '/school-admissions-portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/school-admissions-portal/application', label: 'Application Form', icon: FileText },
  { href: '/school-admissions-portal/documents', label: 'Documents', icon: ClipboardList },
  { href: '/school-admissions-portal/payment', label: 'Fee & Receipt', icon: Receipt },
  { href: '/school-admissions-portal/review', label: 'Review & Submit', icon: ClipboardCheck },
  { href: '/school-admissions-portal/help', label: 'Help', icon: HelpCircle },
];

export function SchoolApplicantNav({
  children,
  sidebar,
  framed = true,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  framed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const enabled = useAuthQueryEnabled();
  const me = useQuery({
    queryKey: ['school-applicant-me'],
    queryFn: fetchSchoolApplicantMe,
    enabled,
  });
  const name = me.data?.application.firstName ?? '';
  const appNo = me.data?.application.applicationNumber ?? '';

  return (
    <SchoolAdmissionsShell>
      <div className="-mx-4 mb-6 border-b border-slate-200 bg-white shadow-sm sm:-mx-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <nav className="flex flex-wrap gap-1">
            {LINKS.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm',
                    active
                      ? 'bg-[#1a5336] text-white'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-[#1a5336]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="hidden text-right sm:block">
              <p className="font-semibold uppercase text-[#1a5336]">{name}</p>
              <p className="font-mono text-xs text-slate-500">{appNo}</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-[#1a5336] px-3 py-1.5 text-[#1a5336] hover:bg-emerald-50"
              onClick={() =>
                logoutClientSide(router, { redirectTo: '/school-admissions-portal/login' })
              }
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
      <div className={cn(sidebar ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]' : '')}>
        <div
          className={
            framed ? 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6' : ''
          }
        >
          {children}
        </div>
        {sidebar ? <div className="space-y-4">{sidebar}</div> : null}
      </div>
    </SchoolAdmissionsShell>
  );
}
