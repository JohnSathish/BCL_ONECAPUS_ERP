'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PoweredByBaseCodeLabs } from '@/components/branding/powered-by-basecode-labs';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { SCHOOL_PORTAL_LOGO_SRC } from '@/lib/school-admissions-branding';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/admin', label: 'Office home' },
  { href: '/admin/school-admissions', label: 'K.G. applications' },
  { href: '/admin/school-admissions/admission-settings', label: 'Admission Settings' },
];

export function SchoolOfficeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-[#f4f1ea] text-slate-900">
      <header className="border-b border-[#1b4d3e]/15 bg-gradient-to-r from-[#0f241c] via-[#1b4d3e] to-[#14382d] text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
          <img
            src={SCHOOL_PORTAL_LOGO_SRC}
            alt="Tura Public School"
            width={56}
            height={70}
            className="h-14 w-auto shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-amber-200/90">TPS Tura</p>
            <h1 className="text-lg font-semibold sm:text-xl">School office</h1>
            <p className="text-sm text-emerald-100/80">K.G. Admission · Session 2027</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => logoutClientSide(router, { redirectTo: '/login' })}
          >
            Logout
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 px-4 pb-3 sm:px-6">
          {LINKS.map((link) => {
            const active =
              link.href === '/admin'
                ? pathname === '/admin'
                : link.href === '/admin/school-admissions'
                  ? pathname === '/admin/school-admissions' ||
                    Boolean(pathname?.match(/^\/admin\/school-admissions\/[^/]+$/))
                  : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm',
                  active ? 'bg-white text-emerald-900' : 'bg-white/10 hover:bg-white/20',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      <footer className="border-t border-[#1b4d3e]/15 bg-white px-4 py-4 text-center text-xs text-slate-500 sm:px-6">
        <PoweredByBaseCodeLabs className="text-[#1b4d3e] underline" />
      </footer>
    </div>
  );
}
