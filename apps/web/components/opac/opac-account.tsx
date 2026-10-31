'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import {
  AlarmClock,
  BookMarked,
  BookOpen,
  CalendarClock,
  History,
  IndianRupee,
  Library,
  LogOut,
  Megaphone,
  MonitorSmartphone,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  cancelOpacReservation,
  fetchOpacAccount,
  fetchOpacHome,
  renewOpacCopy,
} from '@/services/opac';
import { useAuthStore } from '@/store/auth-store';
import { BookCard } from './book-card';

function when(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function whenStamp(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dueLabel(value: string, overdue: boolean) {
  const date = new Date(value);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (overdue || days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

export function OpacAccount() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');
  const account = useQuery({
    queryKey: ['opac', 'account'],
    queryFn: fetchOpacAccount,
    enabled: Boolean(session),
  });
  const home = useQuery({ queryKey: ['opac', 'home'], queryFn: fetchOpacHome });
  const renew = useMutation({
    mutationFn: renewOpacCopy,
    onSuccess: async () => {
      setNotice('The book was renewed.');
      await queryClient.invalidateQueries({ queryKey: ['opac', 'account'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setNotice(error.response?.data?.message || 'This book cannot be renewed.');
    },
  });
  const cancel = useMutation({
    mutationFn: cancelOpacReservation,
    onSuccess: async () => {
      setNotice('The reservation was cancelled.');
      await queryClient.invalidateQueries({ queryKey: ['opac', 'account'] });
    },
    onError: () => setNotice('The reservation could not be cancelled.'),
  });

  function search(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    router.push(`/opac/search?${params.toString()}`);
  }

  if (!session) {
    return (
      <p className="p-6 text-sm text-slate-600">
        <Link href="/opac/login" className="font-semibold text-sky-800">
          Log in
        </Link>{' '}
        with your college account to see borrowed books, reservations, and fines.
      </p>
    );
  }
  if (account.isLoading) {
    return <p className="p-6 text-sm text-slate-500">Loading your library account…</p>;
  }
  if (account.isError || !account.data) {
    return (
      <p className="p-6 text-sm text-red-700">This login is not linked to a library member.</p>
    );
  }

  const data = account.data;
  const photo = resolveUploadAssetUrl(data.profile.photoUrl);
  const codeLabel = data.profile.memberType === 'Student' ? 'Roll No' : 'Staff code';
  const statusLabel = (data.profile.status || 'Active').replace(/_/g, ' ').toLowerCase();
  const statusText = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);
  const announcements = data.announcements ?? [];
  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });
  const activity = [
    ...data.loans.map((loan) => ({
      id: `issued-${loan.id}`,
      text: `Book issued — ${loan.title} (Acc. ${loan.accession})`,
      at: loan.issuedAt,
    })),
    ...data.history
      .filter((row) => row.returnedAt)
      .map((row) => ({
        id: `returned-${row.id}`,
        text: `Book returned — ${row.title} (Acc. ${row.accession})`,
        at: row.returnedAt as string,
      })),
    ...data.reservations.map((row) => ({
      id: `reserved-${row.id}`,
      text: `Book reserved — ${row.title}`,
      at: row.reservedAt,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  const nav = [
    ['#top', 'My Library', Library],
    ['/opac/search', 'Search Books', Search],
    ['#borrowed', 'My Borrowed Books', BookOpen],
    ['#reservations', 'Reservations', BookMarked],
    ['#history', 'My Reading History', History],
    ['/opac/digital', 'Digital Library', MonitorSmartphone],
    ['#profile', 'My Profile', UserRound],
  ] as const;

  return (
    <div id="top" className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="bg-slate-950 text-slate-100 lg:min-h-screen">
        <div id="profile" className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-800 text-lg font-bold">
                {data.profile.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-bold">{data.profile.name}</p>
              {data.profile.code ? (
                <p className="truncate text-xs text-slate-300">
                  {codeLabel}: {data.profile.code}
                </p>
              ) : null}
              {data.profile.department ? (
                <p className="truncate text-xs text-slate-400">
                  Department: {data.profile.department}
                </p>
              ) : null}
              {data.profile.card ? (
                <p className="truncate text-xs text-slate-400">Member ID: {data.profile.card}</p>
              ) : null}
            </div>
          </div>
          <p className="mt-3 inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">
            {statusText} Member
          </p>
        </div>
        <nav className="space-y-1 p-3 text-sm">
          {nav.map(([href, label, Icon]) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-200 hover:bg-white/10"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {data.showFines ? (
            <Link
              href="#fines"
              className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/10"
            >
              <IndianRupee className="h-4 w-4" />
              My Fines
            </Link>
          ) : null}
          {announcements.length ? (
            <Link
              href="#notices"
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Notices
              </span>
              <span className="rounded-full bg-rose-500 px-1.5 text-xs font-bold">
                {announcements.length}
              </span>
            </Link>
          ) : null}
        </nav>
        <button
          type="button"
          className="m-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
          onClick={() => logoutClientSide(router, { redirectTo: '/opac', clearWorkspace: false })}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </aside>

      <div>
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <form onSubmit={search} className="flex min-w-[240px] flex-1 gap-2">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search books by title, author, ISBN, subject, accession number..."
              className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
            />
            <button
              type="submit"
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-900">
                {data.profile.name.charAt(0)}
              </span>
            )}
            <span>
              <span className="block font-semibold">{data.profile.name}</span>
              <span className="block text-xs text-slate-500">{data.profile.memberType}</span>
            </span>
          </div>
        </header>

        <div className="space-y-5 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Welcome back,</p>
              <h1 className="text-2xl font-extrabold">{data.profile.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {data.profile.code ? `${codeLabel}: ${data.profile.code}` : data.profile.memberType}
                {data.profile.department ? ` · Department: ${data.profile.department}` : ''}
                {` · Member Type: ${data.profile.memberType}`}
              </p>
              <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                {statusText} Member
              </span>
            </div>
            <p className="text-sm text-slate-500">Today · {today}</p>
          </div>

          {notice ? (
            <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">{notice}</p>
          ) : null}

          <section className={`grid gap-3 ${data.showFines ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <Stat
              icon={BookOpen}
              tint="bg-sky-50 text-sky-800"
              value={data.stats.borrowed}
              label="Currently Borrowed"
            />
            <Stat
              icon={AlarmClock}
              tint="bg-rose-50 text-rose-800"
              value={data.stats.overdue}
              label="Overdue Books"
            />
            <Stat
              icon={CalendarClock}
              tint="bg-emerald-50 text-emerald-800"
              value={data.stats.reservations}
              label="Reservations"
            />
            {data.showFines ? (
              <Stat
                icon={IndianRupee}
                tint="bg-violet-50 text-violet-800"
                value={`₹${Number(data.stats.outstandingFine ?? 0).toLocaleString('en-IN')}`}
                label="Outstanding Fine"
              />
            ) : null}
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <section id="borrowed" className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">Currently Borrowed Books</h2>
              {data.loans.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No books are issued to this account.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="py-2">Title</th>
                        <th>Accession No.</th>
                        <th>Issue Date</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.loans.map((loan) => (
                        <tr key={loan.id} className="border-t border-slate-100">
                          <td className="py-3">
                            <p className="font-semibold">{loan.title}</p>
                            {loan.author ? (
                              <p className="text-xs text-slate-500">{loan.author}</p>
                            ) : null}
                          </td>
                          <td>{loan.accession}</td>
                          <td>{when(loan.issuedAt)}</td>
                          <td>{when(loan.dueAt)}</td>
                          <td
                            className={
                              loan.overdue ? 'font-semibold text-rose-700' : 'text-emerald-700'
                            }
                          >
                            {dueLabel(loan.dueAt, loan.overdue)}
                          </td>
                          <td>
                            {data.renewalEnabled ? (
                              <button
                                type="button"
                                className="rounded-lg bg-sky-700 px-3 py-1 text-xs font-semibold text-white"
                                onClick={() => renew.mutate(loan.barcode)}
                              >
                                Renew
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">Quick Actions</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
                <Action href="/opac/search" label="Search Books" />
                <Action href="#borrowed" label="Renew Books" />
                <Action href="/opac/search" label="Reserve Books" />
                {data.showFines ? <Action href="#fines" label="My Fines" /> : null}
                <Action href="#history" label="Reading History" />
                <Action href="/opac/digital" label="Digital Library" />
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section id="reservations" className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">My Reservations</h2>
              {data.reservations.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No active reservations.</p>
              ) : (
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2">Title</th>
                      <th>Request Date</th>
                      <th>Queue</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reservations.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="py-3">
                          <p className="font-semibold">{row.title}</p>
                          {row.author ? (
                            <p className="text-xs text-slate-500">{row.author}</p>
                          ) : null}
                        </td>
                        <td>{when(row.reservedAt)}</td>
                        <td>{row.queuePosition}</td>
                        <td>
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose-700"
                            onClick={() => cancel.mutate(row.id)}
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {announcements.length ? (
              <section id="notices" className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="font-bold">Library Notices</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {announcements.map((row) => (
                    <li
                      key={row.text}
                      className="flex justify-between gap-3 border-b border-slate-100 py-2"
                    >
                      <span>{row.text}</span>
                      {row.date ? (
                        <span className="shrink-0 text-slate-500">{row.date}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {data.showFines ? (
            <section id="fines" className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-bold">Fines</h2>
              {data.fines.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No fine records.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {data.fines.map((fine) => (
                    <li key={fine.id} className="flex justify-between py-3">
                      <span>
                        {fine.title} · {fine.accession} · {fine.status}
                      </span>
                      <span className="font-semibold">₹{fine.amount.toLocaleString('en-IN')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section id="history" className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-bold">Recent Library Activity</h2>
            {activity.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No library activity on this account yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {activity.map((row) => (
                  <li
                    key={row.id}
                    className="flex justify-between gap-3 border-b border-slate-100 py-2"
                  >
                    <span>{row.text}</span>
                    <span className="shrink-0 text-slate-500">{whenStamp(row.at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {data.history.length ? (
              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {data.history.map((row) => (
                  <li key={row.id} className="py-2">
                    <p className="font-semibold">{row.title}</p>
                    <p className="text-slate-500">
                      {row.accession} · Issued {when(row.issuedAt)} · Returned{' '}
                      {row.returnedAt ? when(row.returnedAt) : '—'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No returned books yet.</p>
            )}
          </section>

          {home.data?.mostBorrowed.length ? (
            <section>
              <h2 className="mb-3 text-lg font-bold">Popular in the library</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {home.data.mostBorrowed.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  tint,
  value,
  label,
}: {
  icon: typeof BookOpen;
  tint: string;
  value: number | string;
  label: string;
}) {
  return (
    <div className={`rounded-2xl px-4 py-4 ${tint}`}>
      <Icon className="h-5 w-5" />
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

function Action({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 hover:bg-sky-50"
    >
      <RefreshCw className="h-4 w-4 text-sky-700" />
      {label}
    </Link>
  );
}
