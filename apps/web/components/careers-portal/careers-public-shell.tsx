'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchCareersPortalInfo } from '@/services/careers-portal';
import { CareersFooter } from '@/components/careers-portal/careers-footer';
import { CareersFloatingWidgets } from '@/components/careers-portal/careers-floating-widgets';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

const NAV = [
  { href: '/careers-portal', label: 'Home' },
  { href: '/careers-portal/jobs', label: 'Openings' },
  { href: '/careers-portal/apply', label: 'Apply' },
  { href: '/careers-portal/application-status', label: 'Track Status' },
];

export function CareersPublicShell({
  children,
  fullWidth,
  hideHeroPadding,
  showFloatingWidgets = true,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
  hideHeroPadding?: boolean;
  showFloatingWidgets?: boolean;
}) {
  const pathname = usePathname();
  const infoQ = useQuery({
    queryKey: ['careers-portal-info'],
    queryFn: fetchCareersPortalInfo,
  });
  const info = infoQ.data;

  return (
    <div className="min-h-screen bg-[#0c1829] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.12), transparent 40%), radial-gradient(circle at 80% 0%, rgba(200,16,46,0.08), transparent 35%)',
        }}
      />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0c1829]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:py-4">
          <Link href="/careers-portal" className="flex items-center gap-4">
            {info?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveUploadAssetUrl(info.logoUrl) ?? info.logoUrl}
                alt={info.collegeName ?? 'Don Bosco College'}
                className="h-12 w-12 rounded-xl object-contain bg-white p-1 shadow-md sm:h-14 sm:w-14"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-sm font-bold text-[#1e3a5f] shadow-md sm:h-14 sm:w-14">
                DBC
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-400 sm:text-xs">
                Official Careers Portal
              </p>
              <p className="text-sm font-bold leading-tight sm:text-base lg:text-lg">
                {info?.collegeName?.toUpperCase() ?? 'DON BOSCO COLLEGE TURA'}
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  pathname === item.href ||
                    (item.href !== '/careers-portal' && pathname?.startsWith(item.href))
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/careers-portal/jobs"
            className="rounded-full bg-[#c8102e] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition hover:bg-[#a50d25]"
          >
            View Jobs
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main
        className={cn(
          'relative',
          fullWidth ? 'mx-auto max-w-[1400px] px-4 sm:px-6' : 'mx-auto max-w-6xl px-4 sm:px-6',
          hideHeroPadding ? 'py-0' : 'py-8 sm:py-12',
        )}
      >
        {children}
      </main>
      <CareersFooter />
      {showFloatingWidgets ? <CareersFloatingWidgets info={info} /> : null}
    </div>
  );
}
