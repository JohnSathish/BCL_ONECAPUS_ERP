'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { fetchAlumniPortalInfo } from '@/services/alumni-portal';
import { cn } from '@/utils/cn';

const DEFAULT_LOGO_URL = '/branding/basecode-labs-logo.png';

const NAV = [
  { href: '/alumni-portal', label: 'Home', exact: true },
  { href: '/alumni-portal/about', label: 'About Us' },
  { href: '/alumni-portal/events', label: 'Events' },
  { href: '/alumni-portal/members', label: 'Members' },
  { href: '/alumni-portal/gallery', label: 'Gallery' },
  { href: '/alumni-portal/contact', label: 'Contact' },
];

type Props = {
  children: React.ReactNode;
  collegeName?: string;
  associationName?: string;
  logoUrl?: string | null;
};

export function AlumniPublicShell({
  children,
  collegeName = 'Don Bosco College Tura',
  associationName,
  logoUrl,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const portalQ = useQuery({
    queryKey: ['alumni-portal-info'],
    queryFn: fetchAlumniPortalInfo,
    staleTime: 60_000,
  });
  const settings = portalQ.data?.settings;
  const resolvedLogoUrl = logoUrl || settings?.logoUrl || DEFAULT_LOGO_URL;
  const resolvedAssociationName =
    associationName || settings?.associationName || 'Alumni Association';

  return (
    <div className="alumni-portal flex min-h-screen flex-col bg-[#f4f1ea] text-[#1a2b47]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1a2b47]/95 text-white shadow-lg backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 lg:px-6">
          <Link
            href="/alumni-portal"
            className="flex items-center gap-3"
            onClick={() => setOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedLogoUrl}
              alt={`${collegeName} logo`}
              className="h-11 w-11 rounded-full bg-white object-contain p-0.5 ring-2 ring-[#f3b63b]/40"
            />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90 sm:text-[11px]">
                {collegeName}
              </p>
              <p className="font-serif text-sm text-[#f3b63b] sm:text-[15px]">
                {resolvedAssociationName}
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Alumni portal">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors',
                    active ? 'text-[#f3b63b]' : 'text-white/85 hover:text-[#f3b63b]',
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-[#f3b63b]" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/alumni-portal/register"
              className="rounded-md bg-[#f3b63b] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#1a2b47] shadow-sm transition hover:bg-[#e5a82e] sm:px-4 sm:text-xs"
            >
              Join Us
            </Link>
            <button
              type="button"
              className="rounded-md p-2 text-white/90 hover:bg-white/10 lg:hidden"
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open ? (
          <nav className="border-t border-white/10 px-4 py-3 lg:hidden" aria-label="Mobile">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'rounded-md px-3 py-2.5 text-xs font-semibold uppercase tracking-wide',
                      active ? 'bg-white/10 text-[#f3b63b]' : 'text-white/90 hover:bg-white/5',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-auto border-t border-[#f3b63b]/25 bg-[#142238] text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
          <div className="sm:col-span-2">
            <p className="font-serif text-lg text-[#f3b63b]">{resolvedAssociationName}</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
              Connecting generations of Bosconians in fellowship, mentorship, and service to
              {` ${collegeName}`} and society.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f3b63b]">Explore</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li>
                <Link href="/alumni-portal/about" className="hover:text-[#f3b63b]">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/alumni-portal/events" className="hover:text-[#f3b63b]">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/alumni-portal/members" className="hover:text-[#f3b63b]">
                  Directory
                </Link>
              </li>
              <li>
                <Link href="/alumni-portal/register" className="hover:text-[#f3b63b]">
                  Membership
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f3b63b]">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li>
                <Link href="/alumni-portal/contact" className="hover:text-[#f3b63b]">
                  Get in touch
                </Link>
              </li>
              <li>Tura, Meghalaya, India</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <p>
              © {new Date().getFullYear()} {collegeName} {resolvedAssociationName}
            </p>
            <p>Powered by BCL OneCampus ERP</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
