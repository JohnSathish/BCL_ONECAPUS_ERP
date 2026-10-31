'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Building2,
  HelpCircle,
  Home,
  Info,
  Library,
  LogIn,
  MonitorSmartphone,
  Search,
} from 'lucide-react';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { fetchOpacHome } from '@/services/opac';
import { useAuthStore } from '@/store/auth-store';

const links = [
  { href: '/opac', label: 'Home', icon: Home },
  { href: '/opac/search', label: 'Search Books', icon: Search },
  { href: '/opac/departments', label: 'Departments', icon: Building2 },
  { href: '/opac/digital', label: 'Digital Library', icon: MonitorSmartphone },
  { href: '/opac/info', label: 'Library Information', icon: Info },
];

export function OpacShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const home = useQuery({ queryKey: ['opac', 'home'], queryFn: fetchOpacHome });
  const brand = home.data;
  const memberDesk = pathname.startsWith('/opac/account');

  if (memberDesk) {
    return <div className="min-h-screen bg-slate-100 text-slate-900">{children}</div>;
  }

  const place = [brand?.campus, brand?.address].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/opac" className="flex min-w-0 items-center gap-3">
            {brand?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="h-12 w-12 rounded-full object-contain" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-800 text-white">
                <Library className="h-6 w-6" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold uppercase tracking-wide text-slate-950">
                {brand?.collegeName ?? 'College library'}
              </span>
              {place ? (
                <span className="block truncate text-xs text-slate-500">{place}</span>
              ) : null}
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                    active
                      ? 'bg-sky-50 font-semibold text-sky-800'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/opac/info"
              className="hidden items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 sm:inline-flex"
            >
              <HelpCircle className="h-4 w-4" />
              Help
            </Link>
            {session ? (
              <>
                <Link
                  href="/opac/account"
                  className="inline-flex items-center gap-1 rounded-full bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  <BookOpen className="h-4 w-4" />
                  My Library
                </Link>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
                  onClick={() =>
                    logoutClientSide(router, { redirectTo: '/opac', clearWorkspace: false })
                  }
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/opac/login"
                className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white"
              >
                <LogIn className="h-4 w-4" />
                Login
              </Link>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className={pathname === '/opac' ? '' : 'mx-auto max-w-7xl px-4 py-6'}>{children}</main>
    </div>
  );
}
