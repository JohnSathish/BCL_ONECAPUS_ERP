'use client';

import NextLink from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import {
  ChevronDown,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Moon,
  Phone,
  Search,
  Share2,
  Sun,
  User,
  X,
} from 'lucide-react';
import { fetchJournalPortalInfo, fetchJournalPortalMe } from '@/services/journals-portal';
import { bootstrapSession, logout as apiLogout } from '@/services/auth';
import { HOME_FOOTER_INDEXING } from '@/components/journals-portal/home/transient-home-static';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';

const NAVY = '#0B1F3A';
const TOPBAR = '#000B1E';
const DEFAULT_LOGO = '/branding/college-logo.png';

function resolveAuthorLabel(displayName?: string | null, email?: string | null) {
  const name = displayName?.trim() || '';
  const mail = email?.trim() || '';
  if (name && !name.includes('@') && name.toLowerCase() !== mail.toLowerCase()) {
    return name;
  }
  if (mail.includes('@')) {
    const local = mail.split('@')[0] || 'Author';
    return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name || 'Author';
}

type NavItem = { href: string; label: string; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const PRIMARY: NavItem[] = [
  { href: '/journals-portal', label: 'Home', exact: true },
  { href: '/journals-portal/about', label: 'About' },
];

const CURRENT_ISSUE: NavGroup = {
  label: 'Current Issue',
  items: [
    { href: '/journals-portal/current-issue', label: 'View Current Issue' },
    { href: '/journals-portal/archives', label: 'Browse Archives' },
  ],
};

const ARCHIVES: NavItem = { href: '/journals-portal/archives', label: 'Archives' };

const EDITORIAL: NavGroup = {
  label: 'Editorial Board',
  items: [
    { href: '/journals-portal/editorial-board', label: 'Editorial Board' },
    { href: '/journals-portal/advisory-board', label: 'Advisory Board' },
  ],
};

const FOR_AUTHORS: NavGroup = {
  label: 'For Authors',
  items: [
    { href: '/journals-portal/author-guidelines', label: 'Author Guidelines' },
    { href: '/journals-portal/peer-review', label: 'Peer Review' },
    { href: '/journals-portal/ethics', label: 'Publication Ethics' },
    { href: '/journals-portal/author', label: 'Submit Manuscript' },
  ],
};

const TRAILING: NavItem[] = [
  { href: '/journals-portal/downloads', label: 'Downloads' },
  { href: '/journals-portal/contact', label: 'Contact' },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function groupActive(pathname: string, group: NavGroup) {
  return group.items.some((item) => pathname.startsWith(item.href));
}

function JournalThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = (mounted ? resolvedTheme : 'light') === 'dark';
  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-md p-2 text-[var(--jp-ink)]/55 transition hover:text-[var(--jp-ink)]"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const active = groupActive(pathname, group);
  return (
    <div className="jp-nav-dropdown">
      <button
        type="button"
        data-active={active}
        className="jp-nav-link inline-flex items-center gap-0.5 uppercase"
      >
        {group.label}
        <ChevronDown className="h-3 w-3 opacity-55" />
      </button>
      <div className="jp-nav-dropdown-panel">
        {group.items.map((item) => (
          <NextLink key={item.href} href={item.href}>
            {item.label}
          </NextLink>
        ))}
      </div>
    </div>
  );
}

type Props = { children: React.ReactNode };

export function JournalPublicShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
    staleTime: 60_000,
  });
  const meQ = useQuery({
    queryKey: ['journal-me'],
    queryFn: fetchJournalPortalMe,
    enabled: Boolean(session?.accessToken),
    staleTime: 60_000,
    retry: false,
  });

  const journal = infoQ.data?.journal;
  const logo = journal?.logoUrl || DEFAULT_LOGO;
  const title = journal?.name || 'Transient';
  const email = journal?.contactEmail || 'transient.journal@donboscocollege.ac.in';
  const phone = journal?.contactPhone || '+91 96128 12345';
  const issn = journal?.issn;

  const authorName = useMemo(() => {
    return resolveAuthorLabel(
      meQ.data?.displayName || meQ.data?.profile?.displayName || session?.user?.displayName,
      meQ.data?.email || session?.user?.email,
    );
  }, [meQ.data, session?.user]);

  const authorEmail = meQ.data?.email || session?.user?.email || '';
  const isSignedIn = Boolean(session?.accessToken);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (session?.accessToken) return;
      try {
        const restored = await bootstrapSession();
        if (!cancelled && restored?.accessToken) {
          setSession(restored);
          useAuthStore.getState().setBootstrapping(false);
        }
      } catch {
        /* no session */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, setSession]);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await apiLogout();
    } catch {
      /* still clear local session */
    } finally {
      clear();
      setLoggingOut(false);
      setOpen(false);
      router.push('/journals-portal/login');
    }
  }

  const mobileLinks = [
    ...PRIMARY,
    { href: '/journals-portal/current-issue', label: 'Current Issue' },
    ARCHIVES,
    { href: '/journals-portal/editorial-board', label: 'Editorial Board' },
    ...FOR_AUTHORS.items,
    ...TRAILING,
    ...(isSignedIn
      ? [
          { href: '/journals-portal/author', label: 'My submissions' },
          { href: '/journals-portal/search', label: 'Search' },
        ]
      : [
          { href: '/journals-portal/login', label: 'Login' },
          { href: '/journals-portal/search', label: 'Search' },
        ]),
  ];

  return (
    <div className="journals-portal jp-grain flex min-h-screen flex-col text-[var(--jp-ink)]">
      <div className="relative z-30 text-[11px] text-white/90" style={{ backgroundColor: TOPBAR }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <a
              href={`mailto:${email}`}
              className="inline-flex min-w-0 items-center gap-1.5 truncate text-white/90 hover:text-white"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="truncate">{email}</span>
            </a>
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="hidden items-center gap-1.5 text-white/90 hover:text-white sm:inline-flex"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span>{phone}</span>
              </a>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0 text-white/90">
            {issn ? (
              <>
                <span className="hidden font-medium tracking-wide sm:inline">ISSN: {issn}</span>
                <span className="mx-3 hidden h-3 w-px bg-white/30 sm:inline-block" aria-hidden />
              </>
            ) : null}
            {isSignedIn ? (
              <>
                <NextLink
                  href="/journals-portal/author"
                  className="inline-flex max-w-[140px] items-center gap-1.5 truncate hover:text-white sm:max-w-[180px]"
                  title={authorEmail}
                >
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{authorName}</span>
                </NextLink>
                <span className="mx-3 h-3 w-px bg-white/30" aria-hidden />
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  disabled={loggingOut}
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {loggingOut ? 'Signing out…' : 'Logout'}
                </button>
              </>
            ) : (
              <>
                <NextLink
                  href="/journals-portal/register"
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  <User className="h-3.5 w-3.5" />
                  Register
                </NextLink>
                <span className="mx-3 h-3 w-px bg-white/30" aria-hidden />
                <NextLink
                  href="/journals-portal/login"
                  className="inline-flex items-center gap-1.5 hover:text-white"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Login
                </NextLink>
              </>
            )}
          </div>
        </div>
      </div>

      <header
        className={cn(
          'sticky top-0 z-40 border-b border-[var(--jp-border)] bg-white dark:bg-[var(--jp-card)]',
          scrolled && 'shadow-[0_8px_24px_rgba(11,31,58,0.08)]',
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <NextLink
            href="/journals-portal"
            className="flex min-w-0 items-center gap-2.5"
            onClick={() => setOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-[rgba(201,162,39,0.35)]"
            />
            <div className="min-w-0 leading-tight">
              <p className="jp-serif truncate text-[1.45rem] leading-none tracking-tight text-[var(--jp-ink)] sm:text-[1.65rem]">
                {title}
              </p>
              <p className="mt-1 max-w-[220px] text-[9px] leading-snug text-[var(--jp-muted)] sm:max-w-[280px] sm:text-[10px]">
                A Journal of Natural Sciences and Allied Subjects
                <br />
                (a peer reviewed journal) Don Bosco College, Tura
              </p>
            </div>
          </NextLink>

          <nav className="hidden items-center xl:flex" aria-label="Journal">
            {PRIMARY.map((item) => (
              <NextLink
                key={item.href}
                href={item.href}
                data-active={isActive(pathname, item)}
                className="jp-nav-link uppercase"
              >
                {item.label}
              </NextLink>
            ))}
            <NavDropdown group={CURRENT_ISSUE} pathname={pathname} />
            <NextLink
              href={ARCHIVES.href}
              data-active={isActive(pathname, ARCHIVES)}
              className="jp-nav-link uppercase"
            >
              {ARCHIVES.label}
            </NextLink>
            <NavDropdown group={EDITORIAL} pathname={pathname} />
            <NavDropdown group={FOR_AUTHORS} pathname={pathname} />
            {TRAILING.map((item) => (
              <NextLink
                key={item.href}
                href={item.href}
                data-active={isActive(pathname, item)}
                className="jp-nav-link uppercase"
              >
                {item.label}
              </NextLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <NextLink
              href="/journals-portal/search"
              aria-label="Search"
              className="hidden rounded-md p-2 text-[var(--jp-ink)]/60 transition hover:text-[var(--jp-ink)] lg:inline-flex"
            >
              <Search className="h-4 w-4" />
            </NextLink>
            <div className="hidden sm:block">
              <JournalThemeToggle />
            </div>
            <button
              type="button"
              className="rounded-md border border-[var(--jp-border)] p-2 xl:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-[var(--jp-border)] bg-white dark:bg-[var(--jp-card)] xl:hidden">
            <div className="flex max-h-[70vh] flex-col overflow-y-auto px-4 py-2">
              {isSignedIn ? (
                <div className="border-b border-[var(--jp-border)] py-3">
                  <p className="text-sm font-semibold text-[var(--jp-ink)]">{authorName}</p>
                  <p className="truncate text-xs text-[var(--jp-muted)]">{authorEmail}</p>
                </div>
              ) : null}
              {mobileLinks.map((item) => (
                <NextLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-[var(--jp-border)] py-3 text-sm font-medium uppercase tracking-wide"
                >
                  {item.label}
                </NextLink>
              ))}
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="border-b border-[var(--jp-border)] py-3 text-left text-sm font-semibold text-red-700"
                >
                  {loggingOut ? 'Signing out…' : 'Logout'}
                </button>
              ) : null}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-[var(--jp-muted)]">Appearance</span>
                <JournalThemeToggle />
              </div>
              <NextLink
                href="/journals-portal/author"
                onClick={() => setOpen(false)}
                className="jp-btn jp-btn-gold my-3 rounded-sm py-2.5 text-center"
              >
                Submit Paper
              </NextLink>
            </div>
          </div>
        ) : null}
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="relative z-10 mt-auto text-white" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-5 lg:px-6">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt=""
                className="h-9 w-9 rounded-full bg-white object-contain p-0.5"
              />
              <p className="jp-serif text-2xl font-semibold tracking-tight">{title}</p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              {journal?.publisher || 'Don Bosco College, Tura'} — peer-reviewed open-access
              scholarship in the natural sciences and allied subjects.
            </p>
            {issn ? (
              <p className="mt-3 text-xs text-white/50">
                ISSN (Print): {issn}
                <br />
                ISSN (Online): {issn}
              </p>
            ) : null}
            <div className="mt-5 flex items-center gap-3 text-white/70">
              <a href={`mailto:${email}`} aria-label="Email" className="hover:text-white">
                <Mail className="h-4 w-4" />
              </a>
              <a
                href={`mailto:${email}?subject=Transient%20Journal`}
                aria-label="Share"
                className="hover:text-white"
              >
                <Share2 className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E4BC3A]">
              Quick Links
            </p>
            <div className="mt-4 flex flex-col gap-2.5 text-sm text-white/75">
              <NextLink href="/journals-portal/about" className="hover:text-white">
                About
              </NextLink>
              <NextLink href="/journals-portal/current-issue" className="hover:text-white">
                Current Issue
              </NextLink>
              <NextLink href="/journals-portal/archives" className="hover:text-white">
                Archives
              </NextLink>
              <NextLink href="/journals-portal/editorial-board" className="hover:text-white">
                Editorial Board
              </NextLink>
              <NextLink href="/journals-portal/downloads" className="hover:text-white">
                Downloads
              </NextLink>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E4BC3A]">
              Resources
            </p>
            <div className="mt-4 flex flex-col gap-2.5 text-sm text-white/75">
              <NextLink href="/journals-portal/author-guidelines" className="hover:text-white">
                Author Guidelines
              </NextLink>
              <NextLink href="/journals-portal/ethics" className="hover:text-white">
                Publication Ethics
              </NextLink>
              <NextLink href="/journals-portal/peer-review" className="hover:text-white">
                Peer Review
              </NextLink>
              <NextLink href="/journals-portal/indexing" className="hover:text-white">
                Indexing
              </NextLink>
              <NextLink href="/oai?verb=Identify" className="hover:text-white">
                OAI-PMH
              </NextLink>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E4BC3A]">
              Contact Us
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/75">
              Don Bosco College, Tura
              <br />
              West Garo Hills, Meghalaya 794002
              <br />
              India
            </p>
            <a
              href={`mailto:${email}`}
              className="mt-3 block text-sm font-medium text-[#E4BC3A] hover:text-white"
            >
              {email}
            </a>
            {journal?.contactPhone ? (
              <p className="mt-1 text-sm text-white/75">{journal.contactPhone}</p>
            ) : null}
            <NextLink
              href="/journals-portal/contact"
              className="jp-btn jp-btn-gold mt-5 inline-block rounded-sm px-4 py-2"
            >
              Contact Us
            </NextLink>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E4BC3A]">
              Indexed In
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {HOME_FOOTER_INDEXING.map((name) => (
                <span
                  key={name}
                  className="rounded-md border border-white/15 bg-white/5 px-2.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white/80"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-white/10 px-4 py-4 text-[11px] text-white/45 sm:flex-row lg:px-6">
          <p>
            © {new Date().getFullYear()} {journal?.institution || 'Don Bosco College, Tura'}. All
            rights reserved.
          </p>
          <p>Designed for research & scholarly excellence</p>
        </div>
      </footer>
    </div>
  );
}
