'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Mail, MapPin, Menu, Phone, Search, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { COMPANY } from '@/lib/company';
import { cn } from '@/lib/cn';

const PRODUCT_LINKS = [
  { href: '/products', label: 'All products' },
  { href: '/products/bcl-onecampus-erp', label: 'BCL OneCampus ERP' },
  { href: '/products/web-solutions', label: 'Web Solutions' },
  { href: '/products/mobile-applications', label: 'Mobile Applications' },
  { href: '/products/gst-billing', label: 'BCL GST Billing' },
  { href: '/products/custom-software', label: 'Custom Software' },
];

const SERVICE_LINKS = [
  { href: '/services', label: 'All services' },
  { href: '/services#software-development', label: 'Software Development' },
  { href: '/services#web', label: 'Web' },
  { href: '/services#mobile', label: 'Mobile' },
  { href: '/services#infrastructure', label: 'Infrastructure' },
  { href: '/services#digital', label: 'Digital' },
];

const INDUSTRY_LINKS = [
  { href: '/industries#schools', label: 'Schools' },
  { href: '/industries#colleges', label: 'Colleges' },
  { href: '/industries#dioceses', label: 'Dioceses' },
  { href: '/industries#hospitals', label: 'Hospitals' },
  { href: '/industries#businesses', label: 'Businesses' },
  { href: '/industries', label: 'All industries' },
];

const SEARCH_PAGES = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/products', label: 'Products' },
  { href: '/services', label: 'Services' },
  { href: '/industries', label: 'Industries' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/testimonials', label: 'Clients' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
  { href: '/portal/login', label: 'Client login' },
  ...PRODUCT_LINKS.slice(1),
];

function NavDropdown({
  label,
  href,
  items,
  active,
}: {
  label: string;
  href: string;
  items: { href: string; label: string }[];
  active?: boolean;
}) {
  return (
    <div className="group relative">
      <Link
        href={href}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200 transition hover:text-white',
          active && 'bg-blue-600 text-white shadow-[0_0_18px_rgba(37,99,235,0.45)]',
        )}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </Link>
      <div className="invisible absolute left-0 top-full z-50 min-w-[220px] pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="rounded-2xl border border-white/10 bg-[#071833] p-2 shadow-2xl">
          {items.map((item) => (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEARCH_PAGES;
    return SEARCH_PAGES.filter((p) => p.label.toLowerCase().includes(q));
  }, [query]);

  return (
    <header className="sticky top-0 z-50 text-white">
      <div className="hidden border-b border-white/10 bg-[#04101f] text-[12px] text-slate-300 lg:block">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-2 lg:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-cyan-300" />
              Tura, Meghalaya
              <span className="text-slate-600">|</span>
              Bhuvanagiri, Tamil Nadu
            </span>
            <a
              href={`mailto:${COMPANY.email}`}
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <Mail className="h-3.5 w-3.5 text-cyan-300" />
              {COMPANY.email}
            </a>
            <a
              href={`tel:+91${COMPANY.phones[0]}`}
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <Phone className="h-3.5 w-3.5 text-cyan-300" />
              {COMPANY.phoneDisplay}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/products" className="hover:text-white">
              Technology
            </Link>
            <Link href="/testimonials" className="hover:text-white">
              People
            </Link>
            <Link href="/case-studies" className="hover:text-white">
              Impact
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-blue-500/20 bg-[#06152c]/95 shadow-[0_12px_40px_rgba(8,47,120,0.35)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <BrandLogo size={44} />
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-wide">{COMPANY.shortName}</span>
              <span className="hidden text-[11px] text-cyan-200/80 sm:block">
                {COMPANY.tagline}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center xl:flex">
            <Link
              href="/"
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition',
                pathname === '/'
                  ? 'bg-blue-600 text-white shadow-[0_0_18px_rgba(37,99,235,0.45)]'
                  : 'text-slate-200 hover:text-white',
              )}
            >
              Home
            </Link>
            <Link
              href="/about"
              className={cn(
                'rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200 hover:text-white',
                pathname.startsWith('/about') && 'text-white',
              )}
            >
              About
            </Link>
            <NavDropdown
              label="Products"
              href="/products"
              items={PRODUCT_LINKS}
              active={pathname.startsWith('/products')}
            />
            <NavDropdown
              label="Services"
              href="/services"
              items={SERVICE_LINKS}
              active={pathname.startsWith('/services')}
            />
            <NavDropdown
              label="Industries"
              href="/industries"
              items={INDUSTRY_LINKS}
              active={pathname.startsWith('/industries')}
            />
            <Link
              href="/portfolio"
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200 hover:text-white"
            >
              Portfolio
            </Link>
            <Link
              href="/testimonials"
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200 hover:text-white"
            >
              Clients
            </Link>
            <Link
              href="/blog"
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200 hover:text-white"
            >
              Blog
            </Link>
            <Link
              href="/contact"
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200 hover:text-white"
            >
              Contact
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Search the site"
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/15 text-slate-200 hover:bg-white/10 lg:inline-flex"
            >
              <Search className="h-4 w-4" />
            </button>
            <Link
              href="/portal/login"
              className="hidden items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 sm:inline-flex"
            >
              <UserRound className="h-3.5 w-3.5" />
              Client Login
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_rgba(34,211,238,0.35)]"
            >
              Start a Project →
            </Link>
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 xl:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-white/10 bg-[#06152c] px-4 py-4 xl:hidden">
            <div className="mx-auto grid max-w-[1440px] gap-2 text-sm">
              {[
                { href: '/', label: 'Home' },
                { href: '/about', label: 'About' },
                { href: '/products', label: 'Products' },
                { href: '/services', label: 'Services' },
                { href: '/industries', label: 'Industries' },
                { href: '/portfolio', label: 'Portfolio' },
                { href: '/testimonials', label: 'Clients' },
                { href: '/blog', label: 'Blog' },
                { href: '/contact', label: 'Contact' },
                { href: '/portal/login', label: 'Client login' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2 hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
              <a href={`mailto:${COMPANY.email}`} className="px-3 py-2 text-slate-300">
                {COMPANY.email}
              </a>
              <a href={`tel:+91${COMPANY.phones[0]}`} className="px-3 py-2 text-slate-300">
                {COMPANY.phoneDisplay}
              </a>
            </div>
          </div>
        ) : null}
      </div>

      {searchOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="mx-auto mt-24 max-w-lg rounded-3xl border border-white/10 bg-[#071833] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages…"
                className="h-11 w-full bg-transparent text-sm text-white outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchOpen(false);
                  if (e.key === 'Enter' && results[0]) {
                    router.push(results[0].href);
                    setSearchOpen(false);
                  }
                }}
              />
            </div>
            <div className="mt-3 max-h-72 overflow-auto">
              {results.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
                  onClick={() => setSearchOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
