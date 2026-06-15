'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { logout } from '@/services/auth';
import { fetchApplicantMe, fetchPortalInfo } from '@/services/admissions-portal';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { AdmissionsScheduleBanner } from './admissions-schedule-banner';

const NAV = [
  { href: '/admissions-portal/dashboard', label: 'Dashboard' },
  { href: '/admissions-portal/application', label: 'Application' },
  { href: '/admissions-portal/status', label: 'Status' },
] as const;

type Props = {
  children: React.ReactNode;
  showSchedule?: boolean;
  title?: string;
  subtitle?: string;
};

export function AdmissionsPortalShell({ children, showSchedule = false, title, subtitle }: Props) {
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
    <div className="min-h-screen bg-gradient-to-br from-[#0b1628] via-[#152a45] to-[#0f1d33] text-white">
      <header className="border-b border-white/10 bg-[#0b1628]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {branding?.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg border border-white/10 bg-white/10 object-contain p-1"
                unoptimized
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">
                {branding?.shortName ?? 'DBC Tura'}
              </p>
              <h1 className="truncate text-lg font-semibold sm:text-xl">
                {branding?.displayName ?? 'Don Bosco College Tura'}
              </h1>
              <p className="text-xs text-slate-400">
                {branding?.portalSubtitle ?? 'FYUGP Online Admission Portal'}
              </p>
            </div>
          </div>

          {session ? (
            <div className="flex flex-wrap items-center gap-3">
              {me.data?.application?.applicationNumber ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Application No.
                  </p>
                  <p className="font-mono text-sm font-semibold text-sky-200">
                    {me.data.application.applicationNumber}
                  </p>
                </div>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 bg-transparent text-white hover:bg-white/10"
                onClick={() => void handleLogout()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" asChild className="border-white/20 text-white">
                <Link href="/admissions-portal/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/admissions-portal/register">Register</Link>
              </Button>
            </div>
          )}
        </div>

        {session ? (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  pathname?.startsWith(item.href)
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {title ? (
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
        ) : null}

        {showSchedule ? <AdmissionsScheduleBanner info={portalInfo.data} className="mb-6" /> : null}

        {children}
      </main>
    </div>
  );
}
