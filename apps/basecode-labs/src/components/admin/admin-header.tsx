'use client';

import { Bell, CalendarDays, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SEARCH = [
  { q: 'clients', href: '/admin/clients' },
  { q: 'licenses', href: '/admin/licenses' },
  { q: 'leads', href: '/admin/leads' },
  { q: 'products', href: '/admin/products' },
  { q: 'visitors', href: '/admin/visitors' },
  { q: 'legal', href: '/admin/legal' },
  { q: 'settings', href: '/admin/settings' },
];

export function AdminHeader({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => {
    setDate(
      new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
  }, []);
  const initial = (name || 'A').slice(0, 1).toUpperCase();
  const matches = query.trim()
    ? SEARCH.filter((s) => s.q.includes(query.trim().toLowerCase()))
    : [];

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
      <form
        className="relative min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches[0]) router.push(matches[0].href);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients, licenses, leads…"
          className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-16 text-sm outline-none focus:border-cyan-400 focus:bg-white"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">
          Ctrl K
        </kbd>
        {matches.length ? (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {matches.map((m) => (
              <li key={m.href}>
                <button
                  type="button"
                  onClick={() => {
                    router.push(m.href);
                    setQuery('');
                  }}
                  className="w-full px-3 py-2 text-left text-sm capitalize hover:bg-slate-50"
                >
                  {m.q}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
      <p className="hidden items-center gap-2 text-sm text-slate-500 lg:flex">
        <CalendarDays className="h-4 w-4 text-cyan-600" />
        {date}
      </p>
      <button
        type="button"
        aria-label="Notifications"
        className="relative rounded-full border border-slate-200 p-2 text-slate-500"
      >
        <Bell className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2">
        <span className="hidden text-right sm:block">
          <span className="block text-sm font-semibold text-slate-900">{name}</span>
          <span className="text-[11px] text-slate-500">BaseCode Labs</span>
        </span>
        <span
          title={email}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 text-sm font-bold text-white"
        >
          {initial}
        </span>
      </div>
    </header>
  );
}
