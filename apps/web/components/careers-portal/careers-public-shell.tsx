'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { fetchCareersPortalInfo } from '@/services/careers-portal';
import { CareersFooter } from '@/components/careers-portal/careers-footer';
import { CareersFloatingWidgets } from '@/components/careers-portal/careers-floating-widgets';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { cn } from '@/utils/cn';

const LANDING_NAV = [
  { href: '/careers-portal', label: 'Home', hash: null as string | null },
  { href: '/careers-portal#about', label: 'About Us', hash: 'about' },
  { href: '/careers-portal/jobs', label: 'Job Opportunities', hash: null },
  { href: '/careers-portal#why-join', label: 'Why Join Us', hash: 'why-join' },
  { href: '/careers-portal#life', label: 'Life at Bosco', hash: 'life' },
  { href: '/careers-portal#contact', label: 'Contact Us', hash: 'contact' },
];

const INNER_NAV = [
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
  variant = 'default',
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
  hideHeroPadding?: boolean;
  showFloatingWidgets?: boolean;
  /** Landing uses transparent-over-hero navy/gold look from the career redesign. */
  variant?: 'default' | 'landing';
}) {
  const pathname = usePathname();
  const isLanding = variant === 'landing';
  const infoQ = useQuery({
    queryKey: ['careers-portal-info'],
    queryFn: fetchCareersPortalInfo,
  });
  const info = infoQ.data;
  const nav = isLanding ? LANDING_NAV : INNER_NAV;

  return (
    <div
      className={cn(
        'min-h-screen',
        isLanding ? 'bg-[#f4f6fa] text-[#0b1f4a]' : 'bg-[#0c1829] text-white',
      )}
    >
      {!isLanding ? (
        <div
          className="pointer-events-none fixed inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.12), transparent 40%), radial-gradient(circle at 80% 0%, rgba(200,16,46,0.08), transparent 35%)',
          }}
        />
      ) : null}

      <header
        className={cn(
          'z-50',
          isLanding
            ? 'absolute inset-x-0 top-0 border-b border-white/15 bg-gradient-to-b from-[#0b1f4a]/80 to-transparent'
            : 'sticky top-0 border-b border-white/10 bg-[#0c1829]/95 backdrop-blur-xl',
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:py-4">
          <Link href="/careers-portal" className="flex items-center gap-3">
            {info?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveUploadAssetUrl(info.logoUrl) ?? info.logoUrl}
                alt={info.collegeName ?? 'Don Bosco College'}
                className="h-11 w-11 rounded-full object-contain bg-white p-1 shadow-md sm:h-12 sm:w-12"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-[#0b1f4a] shadow-md sm:h-12 sm:w-12">
                DBC
              </div>
            )}
            <div>
              <p
                className={cn(
                  'text-sm font-bold leading-tight tracking-wide sm:text-base',
                  isLanding ? 'text-white' : 'text-white',
                )}
              >
                {(info?.collegeName ?? 'DON BOSCO COLLEGE, TURA').toUpperCase()}
              </p>
              <p
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-xs',
                  isLanding ? 'text-[#f0b429]' : 'text-sky-400',
                )}
              >
                Career Portal
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => {
              const active =
                item.href === '/careers-portal'
                  ? pathname === '/careers-portal'
                  : pathname === item.href ||
                    (item.href !== '/careers-portal' &&
                      !item.href.includes('#') &&
                      Boolean(pathname?.startsWith(item.href)));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative px-3 py-2 text-sm font-medium transition',
                    isLanding
                      ? active
                        ? 'text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#f0b429]'
                        : 'text-white/80 hover:text-white'
                      : active
                        ? 'rounded-full bg-white/15 text-white'
                        : 'rounded-full text-slate-300 hover:bg-white/10 hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {isLanding ? (
            <Link
              href="/careers-portal/apply"
              className="inline-flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <UserRound className="h-4 w-4" />
              Login / Register
            </Link>
          ) : (
            <Link
              href="/careers-portal/jobs"
              className="rounded-full bg-[#c8102e] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition hover:bg-[#a50d25]"
            >
              View Jobs
            </Link>
          )}
        </div>

        <nav
          className={cn(
            'flex gap-1 overflow-x-auto px-4 py-2 lg:hidden',
            isLanding ? 'border-t border-white/10' : 'border-t border-white/5',
          )}
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs',
                isLanding ? 'bg-white/15 text-white' : 'bg-white/10 text-white',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main
        className={cn(
          'relative',
          isLanding
            ? 'mx-auto max-w-none px-0 py-0'
            : fullWidth
              ? 'mx-auto max-w-[1400px] px-4 sm:px-6'
              : 'mx-auto max-w-6xl px-4 sm:px-6',
          !isLanding && (hideHeroPadding ? 'py-0' : 'py-8 sm:py-12'),
        )}
      >
        {children}
      </main>
      <div id="contact">
        <CareersFooter />
      </div>
      {showFloatingWidgets ? <CareersFloatingWidgets info={info} /> : null}
    </div>
  );
}
