'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Eye,
  FileText,
  Headphones,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Package,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { cn } from '@/lib/cn';

const MAIN = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/licenses', label: 'Licenses', icon: KeyRound },
  { href: '/admin/leads', label: 'Leads', icon: Inbox },
  { href: '/admin/testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { href: '/admin/visitors', label: 'Visitors', icon: Eye },
  { href: '/admin/legal', label: 'Legal', icon: FileText },
];

const SYSTEM = [{ href: '/admin/settings', label: 'Settings', icon: Settings }];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-1 flex-col">
      <nav className="space-y-1 text-sm">
        {MAIN.map((l) => {
          const active = l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition',
                active
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_8px_24px_rgba(14,165,233,0.35)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
        System
      </p>
      <nav className="mt-2 space-y-1 text-sm">
        {SYSTEM.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium',
                active
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/admin/login';
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </nav>
      <a
        href="/contact"
        target="_blank"
        rel="noreferrer"
        className="mt-auto flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/20 text-cyan-300">
          <Headphones className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-white">Need help?</span>
          <span className="text-xs text-slate-400">Contact support →</span>
        </span>
      </a>
    </div>
  );
}

export function AdminNav({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col overflow-y-auto bg-[#07111f] p-4 text-slate-200 lg:flex">
        <div className="flex items-center gap-3 px-1 pb-6">
          <BrandLogo size={40} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              BaseCode Central
            </p>
            <p className="text-sm font-semibold text-white">BaseCode Labs Admin</p>
          </div>
        </div>
        <NavLinks />
      </aside>
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 lg:hidden">
        <span className="font-semibold">BaseCode Central</span>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border p-2"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open ? (
        <div className="flex min-h-[70vh] flex-col bg-[#07111f] p-4 lg:hidden">
          <p className="mb-4 text-xs text-slate-400">{name}</p>
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
