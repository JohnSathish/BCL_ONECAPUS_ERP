'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { cancelOpacReservation, fetchOpacAccount, renewOpacCopy } from '@/services/opac';
import { useAuthStore } from '@/store/auth-store';

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysLeft(value: string) {
  const date = new Date(value);
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  return `${days} days left`;
}

export function OpacAccount() {
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const account = useQuery({
    queryKey: ['opac', 'account'],
    queryFn: fetchOpacAccount,
    enabled: Boolean(session),
  });
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

  if (!session) {
    return (
      <p className="text-sm text-slate-600">
        <Link href="/opac/login" className="font-semibold text-sky-800">
          Log in
        </Link>{' '}
        with your college account to see borrowed books, reservations, and fines.
      </p>
    );
  }
  if (account.isLoading)
    return <p className="text-sm text-slate-500">Loading your library account…</p>;
  if (account.isError || !account.data) {
    return <p className="text-sm text-red-700">This login is not linked to a library member.</p>;
  }
  const data = account.data;
  const photo = data.profile.photoUrl;
  const stats = [
    ['Borrowed', data.stats.borrowed],
    ['Due soon', data.stats.dueSoon],
    ['Overdue', data.stats.overdue],
    ['Reserved', data.stats.reservations],
    ['Total borrowed', data.stats.totalBorrowed],
  ] as const;

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        {photo && (photo.startsWith('http') || photo.startsWith('/')) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-900">
            {data.profile.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{data.profile.name}</h1>
          <p className="text-sm text-slate-600">
            {data.profile.memberType}
            {data.profile.code ? ` · ${data.profile.code}` : ''}
            {data.profile.department ? ` · ${data.profile.department}` : ''}
          </p>
          <p className="text-xs font-semibold uppercase text-sky-800">{data.profile.status}</p>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
        {data.showFines ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xl font-bold">
              ₹{Number(data.stats.outstandingFine ?? 0).toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-500">Outstanding fine</p>
          </div>
        ) : null}
      </section>
      {notice ? (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">{notice}</p>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Currently borrowed</h2>
        {data.loans.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No books are issued to this account.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.loans.map((loan) => (
              <li
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{loan.title}</p>
                  <p className="text-slate-500">
                    {loan.accession} · Issued {when(loan.issuedAt)} · Due {when(loan.dueAt)} ·{' '}
                    {daysLeft(loan.dueAt)}
                  </p>
                </div>
                {data.renewalEnabled ? (
                  <button
                    type="button"
                    className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => renew.mutate(loan.barcode)}
                  >
                    Renew
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Reservations</h2>
        {data.reservations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No active reservations.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {data.reservations.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-slate-500">
                    Queue {row.queuePosition} · Requested {when(row.reservedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-red-700"
                  onClick={() => cancel.mutate(row.id)}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {data.showFines ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Fines</h2>
          {data.fines.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No fine records.</p>
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
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Borrowing history</h2>
        {data.history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No returned books yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {data.history.map((row) => (
              <li key={row.id} className="py-3">
                <p className="font-semibold">{row.title}</p>
                <p className="text-slate-500">
                  {row.accession} · Issued {when(row.issuedAt)} · Returned{' '}
                  {row.returnedAt ? when(row.returnedAt) : '—'}
                  {row.renewalCount ? ` · Renewed ${row.renewalCount}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {data.announcements.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Library notices</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.announcements.map((row) => (
              <li key={row.text}>{row.text}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
