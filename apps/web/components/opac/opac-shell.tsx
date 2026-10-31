'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { fetchOpacHome } from '@/services/opac';
import { useAuthStore } from '@/store/auth-store';

const links = [
  { href: '/opac', label: 'Home' },
  { href: '/opac/search', label: 'Search Books' },
  { href: '/opac/departments', label: 'Departments' },
  { href: '/opac/digital', label: 'Digital Library' },
  { href: '/opac/info', label: 'Library Information' },
];

export function OpacShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const home = useQuery({ queryKey: ['opac', 'home'], queryFn: fetchOpacHome });
  const brand = home.data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-11 w-11 rounded-full object-contain" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-700 text-sm font-bold text-white">
              OP
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-wide text-slate-950">
              {brand?.collegeName ?? 'College library'}
            </p>
            <p className="truncate text-xs text-slate-500">Online Library Catalogue</p>
          </div>
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  pathname === link.href
                    ? 'bg-sky-50 font-semibold text-sky-800'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {session ? (
            <div className="flex items-center gap-2">
              <Link
                href="/opac/account"
                className="rounded-full bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white"
              >
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
            </div>
          ) : (
            <Link
              href="/opac/login"
              className="rounded-full bg-sky-700 px-4 py-1.5 text-sm font-semibold text-white"
            >
              Login
            </Link>
          )}
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
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
