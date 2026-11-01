'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Building2,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Home,
  Info,
  LogIn,
  Mail,
  MapPin,
  Menu,
  MonitorSmartphone,
  Phone,
  Search,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { fetchOpacHome } from '@/services/opac';
import { useAuthStore } from '@/store/auth-store';

type NavLink = { href: string; label: string };
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  children?: NavLink[];
};

const items: NavItem[] = [
  { href: '/opac', label: 'Home', icon: Home, match: (pathname) => pathname === '/opac' },
  {
    href: '/opac/search',
    label: 'Search Books',
    icon: Search,
    match: (pathname) => pathname.startsWith('/opac/search'),
    children: [
      { href: '/opac/search', label: 'Advanced Search' },
      { href: '/opac/search?field=title', label: 'Search by Title' },
      { href: '/opac/search?field=author', label: 'Search by Author' },
      { href: '/opac/search?field=isbn', label: 'Search by ISBN' },
      { href: '/opac/search?field=accession', label: 'Search by Accession Number' },
    ],
  },
  {
    href: '/opac/departments',
    label: 'Departments',
    icon: Building2,
    match: (pathname) => pathname.startsWith('/opac/departments'),
    children: [
      { href: '/opac/departments', label: 'Browse All Departments' },
      { href: '/opac/departments', label: 'Department-wise Books' },
    ],
  },
  {
    href: '/opac/digital',
    label: 'Digital Library',
    icon: MonitorSmartphone,
    match: (pathname) => pathname.startsWith('/opac/digital'),
    children: [
      { href: '/opac/digital?kind=ebook', label: 'E-Books' },
      { href: '/opac/digital?kind=journal', label: 'Journals' },
      { href: '/opac/digital?kind=research', label: 'Research Materials' },
    ],
  },
  {
    href: '/opac/info',
    label: 'Library Information',
    icon: Info,
    match: (pathname) => pathname.startsWith('/opac/info'),
    children: [
      { href: '/opac/info#about', label: 'About Library' },
      { href: '/opac/info#rules', label: 'Library Rules' },
      { href: '/opac/info#membership', label: 'Membership Information' },
      { href: '/opac/info#hours', label: 'Opening Hours' },
      { href: '/opac/info#contact', label: 'Contact Library' },
    ],
  },
];

export function OpacShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const home = useQuery({ queryKey: ['opac', 'home'], queryFn: fetchOpacHome });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const brand = home.data;
  const memberDesk = pathname.startsWith('/opac/account');

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  if (memberDesk) {
    return <div className="min-h-screen bg-[#F3F7FC] text-[#14213D]">{children}</div>;
  }

  const place = brand?.address || brand?.campus || 'Tura, Meghalaya';
  const phone = brand?.settings.contactPhone?.trim();
  const email = brand?.settings.contactEmail?.trim();

  return (
    <div className="min-h-screen bg-[#F3F7FC] text-[#14213D]">
      <div className="bg-[#0B2B55] text-[13px] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#8FB4FF]" aria-hidden />
              <span className="truncate">{place}</span>
            </span>
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s/g, '')}`}
                className="inline-flex items-center gap-1.5 hover:text-[#FFB800]"
              >
                <Phone className="h-3.5 w-3.5 text-[#8FB4FF]" aria-hidden />
                {phone}
              </a>
            ) : null}
            {email ? (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 hover:text-[#FFB800]"
              >
                <Mail className="h-3.5 w-3.5 text-[#8FB4FF]" aria-hidden />
                {email}
              </a>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://donboscocollege.ac.in"
              className="inline-flex items-center gap-1.5 hover:text-[#FFB800]"
              target="_blank"
              rel="noreferrer"
            >
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
              College Website
              <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 font-semibold hover:text-[#FFB800]"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden />
              ERP Login
            </Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[#DCE5F0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <Link href="/opac" className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brand?.logoUrl || '/branding/college-logo.png'}
              alt=""
              className="h-12 w-12 shrink-0 object-contain"
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-extrabold uppercase tracking-wide text-[#0B2B55] sm:text-[15px]">
                {brand?.collegeName ?? 'Don Bosco College Tura'}
              </span>
              <span className="block truncate text-[11px] font-medium text-[#1765F5]">
                Fr. Battista Busolin Memorial Library
              </span>
              <span className="hidden truncate text-[11px] text-[#64748B] sm:block">
                Online Public Access Catalogue (OPAC)
              </span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-0.5 xl:flex" aria-label="Library">
            {items.map((item) => (
              <DesktopItem
                key={item.label}
                item={item}
                active={item.match(pathname)}
                open={openMenu === item.label}
                onOpen={() => setOpenMenu(item.label)}
                onClose={() => setOpenMenu((current) => (current === item.label ? null : current))}
              />
            ))}
            <Link
              href="/opac/info#help"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-[#14213D] hover:bg-[#EAF3FF]"
            >
              <HelpCircle className="h-4 w-4" aria-hidden />
              Help
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2 xl:ml-2">
            {session ? (
              <>
                <Link
                  href="/opac/account"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#1765F5] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#0f52d4]"
                >
                  <BookOpen className="h-4 w-4" aria-hidden />
                  My Library
                </Link>
                <button
                  type="button"
                  className="hidden h-10 rounded-full border border-[#DCE5F0] px-3 text-sm font-medium text-[#14213D] sm:inline-flex"
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
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#1765F5] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#0f52d4]"
              >
                <LogIn className="h-4 w-4" aria-hidden />
                Login
              </Link>
            )}
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#DCE5F0] xl:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav
            className="max-h-[70vh] overflow-y-auto border-t border-[#DCE5F0] bg-white px-4 py-3 xl:hidden"
            aria-label="Library"
          >
            {items.map((item) => (
              <MobileItem key={item.label} item={item} pathname={pathname} />
            ))}
            <Link
              href="/opac/info#help"
              className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium"
            >
              <HelpCircle className="h-4 w-4 text-[#1765F5]" aria-hidden />
              Help
            </Link>
          </nav>
        ) : null}
      </header>

      <main className={pathname === '/opac' ? '' : 'mx-auto max-w-7xl px-4 py-6'}>{children}</main>
    </div>
  );
}

function DesktopItem({
  item,
  active,
  open,
  onOpen,
  onClose,
}: {
  item: NavItem;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const Icon = item.icon;
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <div
        className={`inline-flex items-center rounded-full ${
          active ? 'bg-[#1765F5] text-white' : 'text-[#14213D] hover:bg-[#EAF3FF]'
        }`}
      >
        <Link
          href={item.href}
          className="inline-flex items-center gap-1.5 py-2 pl-3 pr-1 text-sm font-medium"
        >
          <Icon className="h-4 w-4" aria-hidden />
          {item.label}
        </Link>
        {item.children ? (
          <button
            type="button"
            className="pr-2"
            aria-expanded={open}
            aria-label={`${item.label} menu`}
            onClick={() => (open ? onClose() : onOpen())}
          >
            <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <span className="w-2" />
        )}
      </div>
      {item.children && open ? (
        <div className="absolute left-0 top-full z-50 min-w-60 pt-2">
          <div className="rounded-xl border border-[#DCE5F0] bg-white py-1 shadow-lg">
            {item.children.map((child) => (
              <Link
                key={child.label}
                href={child.href}
                className="block px-4 py-2.5 text-sm text-[#14213D] hover:bg-[#EAF3FF] hover:text-[#1765F5]"
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  const active = item.match(pathname);
  return (
    <div className="border-b border-[#DCE5F0] last:border-0">
      <div className="flex items-center">
        <Link
          href={item.href}
          className={`flex flex-1 items-center gap-2 px-3 py-3 text-sm font-medium ${
            active ? 'text-[#1765F5]' : 'text-[#14213D]'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {item.label}
        </Link>
        {item.children ? (
          <button
            type="button"
            className="px-3 py-3"
            aria-expanded={open}
            aria-label={`${item.label} menu`}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        ) : null}
      </div>
      {item.children && open ? (
        <div className="pb-2 pl-9">
          {item.children.map((child) => (
            <Link
              key={child.label}
              href={child.href}
              className="block rounded-lg px-3 py-2 text-sm text-[#64748B] hover:bg-[#EAF3FF] hover:text-[#1765F5]"
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
