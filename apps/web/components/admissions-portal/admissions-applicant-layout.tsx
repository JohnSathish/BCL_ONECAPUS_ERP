'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { logout } from '@/services/auth';
import { fetchApplicantMe, fetchPortalInfo } from '@/services/admissions-portal';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePortalCycleSettings } from '@/hooks/use-portal-cycle-settings';
import { useAuthStore } from '@/store/auth-store';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { AdmissionsStepper } from './admissions-stepper';
import { AdmissionsChangePasswordDialog } from './admissions-change-password-dialog';
import { applicantDisplayName, applicantPhotoUrl } from './utils';
import { cn } from '@/utils/cn';

const MAIN_NAV = [
  { href: '/admissions-portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admissions-portal/application', label: 'Application Form', icon: FileText },
  { href: '/admissions-portal/status', label: 'Application Status', icon: BarChart3 },
] as const;

type Props = {
  children: React.ReactNode;
  /** Show numbered form-section stepper in sidebar (application wizard) */
  showFormSections?: boolean;
  formCurrentStep?: number;
  formProgressPercent?: number;
  formMaxStep?: number;
  onFormStepClick?: (step: number) => void;
  formReadOnly?: boolean;
};

export function AdmissionsApplicantLayout({
  children,
  showFormSections = false,
  formCurrentStep = 1,
  formProgressPercent = 0,
  formMaxStep = 7,
  onFormStepClick,
  formReadOnly,
}: Props) {
  const pathname = usePathname();
  const { session } = useAuth();
  const enabled = useAuthQueryEnabled();
  const setSession = useAuthStore((s) => s.setSession);

  const portalInfo = useQuery({
    queryKey: ['admissions-portal-info'],
    queryFn: fetchPortalInfo,
  });

  const me = useQuery({
    queryKey: ['applicant-me'],
    queryFn: fetchApplicantMe,
    enabled,
  });

  const branding = portalInfo.data?.branding;
  const { settings: cycleSettings } = usePortalCycleSettings();
  const app = me.data?.application;
  const displayName = app ? applicantDisplayName(app) : 'Applicant';
  const photo = applicantPhotoUrl(app?.documents);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      tokenRefreshManager.clearSchedule();
      setSession(null);
      window.location.href = '/admissions-portal/login';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-[260px] shrink-0 flex-col bg-[#1a2b4b] text-white">
        <div className="border-b border-white/10 px-4 py-5">
          {branding?.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt=""
              width={40}
              height={40}
              className="mb-2 h-10 w-10 rounded-full object-contain"
              unoptimized
            />
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-200/80">
            {branding?.shortName ?? 'DBC Tura'}
          </p>
          <p className="text-sm font-semibold leading-tight">
            {branding?.displayName ?? 'Don Bosco College Tura'}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
          {MAIN_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-white text-[#1a2b4b] shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}

          <div className="mt-2 space-y-1 border-t border-white/10 pt-3">
            <SidebarLink
              icon={BookOpen}
              label="Admission Instructions"
              href="/admissions-portal/instructions"
            />
            <SidebarLink icon={CreditCard} label="Payments" href="/admissions-portal/payments" />
            <SidebarLink icon={FileText} label="Documents" href="/admissions-portal/documents" />
            <SidebarLink icon={Settings} label="Settings" href="/admissions-portal/settings" />
          </div>

          {showFormSections ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Form Sections
              </p>
              <AdmissionsStepper
                variant="sidebar"
                currentStep={formCurrentStep}
                progressPercent={formProgressPercent}
                readOnly={formReadOnly}
                maxStep={formMaxStep}
                onStepClick={onFormStepClick}
              />
            </div>
          ) : null}
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="w-full rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
          >
            Change Password
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5c2d3a]/80 px-3 py-2 text-sm text-white hover:bg-[#5c2d3a]"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Applicant
            </p>
            <h1 className="text-xl font-bold text-[#1a2b4b]">Admissions Portal</h1>
            <p className="text-sm text-slate-500">
              Monitor your application progress and complete pending tasks.
            </p>
          </div>
          {session && app ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-semibold text-[#1a2b4b]">{displayName}</p>
                <p className="font-mono text-xs text-slate-500">{app.applicationNumber}</p>
              </div>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt=""
                  className="h-11 w-11 rounded-full border-2 border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1a2b4b] text-sm font-bold text-white">
                  {displayName.charAt(0)}
                </div>
              )}
            </div>
          ) : null}
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>

        <AdmissionsChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Don Bosco College Tura. All rights reserved.</p>
          <p className="mt-1">
            Admission Help Desk: {cycleSettings.helpDesk.phone}
            {cycleSettings.helpDesk.email ? ` · ${cycleSettings.helpDesk.email}` : ''} · Powered by
            OneCampus ERP
          </p>
        </footer>
      </div>
    </div>
  );
}

function SidebarLink({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  const pathname = usePathname();
  const active = pathname?.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
        active ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
