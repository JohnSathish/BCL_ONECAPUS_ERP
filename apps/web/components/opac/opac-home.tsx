'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import {
  BookOpen,
  Building2,
  Clock3,
  FolderOpen,
  Library,
  Mail,
  MapPin,
  Megaphone,
  MonitorSmartphone,
  Phone,
  Scale,
  Search,
  Sparkles,
  Tags,
} from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { BookCard } from '@/components/opac/book-card';
import { fetchOpacHome, fetchOpacInfo, type OpacBookCard } from '@/services/opac';
import { useAuthStore } from '@/store/auth-store';

const fields = [
  ['all', 'All Fields'],
  ['title', 'Book title'],
  ['author', 'Author'],
  ['isbn', 'ISBN'],
  ['accession', 'Accession number'],
  ['subject', 'Subject'],
  ['publisher', 'Publisher'],
  ['department', 'Department'],
] as const;

const chips = [
  ['title', 'Book Title'],
  ['author', 'Author'],
  ['isbn', 'ISBN'],
  ['accession', 'Accession No.'],
  ['subject', 'Subject'],
  ['publisher', 'Publisher'],
  ['department', 'Department'],
] as const;

type Info = {
  address: string | null;
  settings: {
    contactPhone: string;
    contactEmail: string;
  };
  rules: {
    studentLoanDays: number;
    studentMaxBooks: number;
    studentRenewals: number;
    facultyLoanDays: number;
    facultyMaxBooks: number;
    finePerDay: number;
    graceDays: number;
    workingDayLoans?: boolean;
    maxReservations: number;
    reservationDays: number;
  };
};

export function OpacHome() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const [q, setQ] = useState('');
  const [field, setField] = useState<(typeof fields)[number][0]>('all');
  const [member, setMember] = useState<'student' | 'staff'>('student');
  const home = useQuery({ queryKey: ['opac', 'home'], queryFn: fetchOpacHome });
  const info = useQuery({
    queryKey: ['opac', 'info'],
    queryFn: () => fetchOpacInfo() as Promise<Info>,
  });

  function search(event?: FormEvent, nextField = field) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (nextField !== 'all') params.set('field', nextField);
    router.push(`/opac/search?${params.toString()}`);
  }

  if (home.isLoading) {
    return <p className="px-4 py-8 text-sm text-slate-500">Loading the catalogue…</p>;
  }
  if (home.isError || !home.data) {
    return <p className="px-4 py-8 text-sm text-red-700">The catalogue could not be loaded.</p>;
  }
  const data = home.data;
  const rules = info.data?.rules;
  const counts = [
    [BookOpen, 'text-sky-700 bg-sky-50', data.cards.copies, 'Total Books (Copies)'],
    [Library, 'text-emerald-700 bg-emerald-50', data.cards.titles, 'Unique Titles'],
    [Tags, 'text-violet-700 bg-violet-50', data.cards.authors, 'Authors'],
    [FolderOpen, 'text-amber-700 bg-amber-50', data.cards.categories, 'Subjects / Categories'],
    [Building2, 'text-rose-700 bg-rose-50', data.cards.departments, 'Departments with Titles'],
  ] as const;
  const tiles = [
    [Building2, 'Browse by Department', 'Explore books by department', '/opac/departments'],
    [BookOpen, 'Browse by Subject', 'Explore books by subject', '/opac/search?field=subject'],
    [FolderOpen, 'Browse by Category', 'Open the catalogue search', '/opac/search'],
    [MonitorSmartphone, 'Digital Library', 'E-books, papers and resources', '/opac/digital'],
    [Sparkles, 'New Arrivals', 'Recently added books', '/opac/search?sort=recent'],
  ] as const;

  return (
    <div className="space-y-8 pb-10">
      <section className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-800 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
              Welcome to
            </p>
            <h1 className="mt-2 text-3xl font-extrabold uppercase leading-tight sm:text-4xl">
              {data.collegeName}
            </h1>
            <p className="mt-2 text-lg text-sky-100">
              Online Library Public Access Catalogue (OPAC)
            </p>
            <p className="mt-2 max-w-xl text-sm text-slate-200">
              Search, discover and explore the library collection of books and research materials.
            </p>
            <form
              onSubmit={(event) => search(event)}
              className="mt-6 flex flex-col gap-2 sm:flex-row"
            >
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search by book title, author, ISBN, subject, accession number..."
                className="h-12 flex-1 rounded-xl border-0 px-4 text-slate-900"
              />
              <select
                value={field}
                onChange={(event) => setField(event.target.value as (typeof fields)[number][0])}
                className="h-12 rounded-xl px-3 text-slate-900"
              >
                {fields.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    field === value
                      ? 'bg-white text-slate-900 ring-white'
                      : 'bg-white/10 text-white ring-white/20'
                  }`}
                  onClick={() => setField(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
            {session ? (
              <div>
                <h2 className="text-lg font-bold">You are signed in</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {session.user.displayName || 'Your library account'} is ready.
                </p>
                <Link
                  href="/opac/account"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 font-semibold text-white"
                >
                  Open My Library
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold">Login to Your Library Account</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Students and staff use the same college password.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(['student', 'staff'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={`h-10 rounded-lg text-sm font-semibold ${
                        member === kind ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                      onClick={() => setMember(kind)}
                    >
                      {kind === 'student' ? 'Student Login' : 'Staff Login'}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <LoginForm
                    compact
                    plain
                    postLoginPath="/opac/account"
                    identifierLabel={
                      member === 'student' ? 'Student ID / Roll number' : 'Staff ID or email'
                    }
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <Link href="/forgot-password" className="font-semibold text-sky-800">
                    Forgot Password?
                  </Link>
                  <Link href="/opac/info" className="font-semibold text-sky-800">
                    Login Help
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {counts.map(([Icon, tone, value, label]) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-xl font-extrabold text-slate-950">
                  {value.toLocaleString('en-IN')}
                </span>
                <span className="block text-xs text-slate-500">{label}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map(([Icon, title, caption, href]) => (
            <Link
              key={title}
              href={href}
              className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-sky-200"
            >
              <Icon className="h-5 w-5 text-sky-700" />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="text-sm text-slate-500">{caption}</p>
            </Link>
          ))}
        </section>

        <BookRow title="Recently Added Books" href="/opac/search?sort=recent" books={data.recent} />
        <BookRow
          title="Most Borrowed Books"
          href="/opac/search?sort=borrowed"
          books={data.mostBorrowed}
        />

        <section className="grid gap-4 lg:grid-cols-4">
          {data.settings.hours.length ? (
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Clock3 className="h-4 w-4 text-sky-700" /> Library Working Hours
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.settings.hours.map((row) => (
                  <li key={row.label} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="font-medium">{row.hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.settings.announcements.length ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Megaphone className="h-4 w-4 text-rose-700" /> Library Notices
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {data.settings.announcements.map((row) => (
                  <li key={row.text}>{row.text}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {rules ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm">
              <h2 className="flex items-center gap-2 font-semibold">
                <Scale className="h-4 w-4 text-emerald-700" /> Rules and Regulations
              </h2>
              <ul className="mt-3 space-y-1 text-slate-700">
                <li>
                  Students may borrow {rules.studentMaxBooks} books for {rules.studentLoanDays}{' '}
                  {rules.workingDayLoans === false ? 'days' : 'working days'}.
                </li>
                <li>
                  Faculty may borrow {rules.facultyMaxBooks} books for {rules.facultyLoanDays}{' '}
                  {rules.workingDayLoans === false ? 'days' : 'working days'}.
                </li>
                <li>Students may renew up to {rules.studentRenewals} times.</li>
                <li>
                  Fine is ₹{rules.finePerDay} per{' '}
                  {rules.workingDayLoans === false ? 'day' : 'overdue working day'} after{' '}
                  {rules.graceDays} grace days.
                </li>
                <li>
                  Up to {rules.maxReservations} reservations, held for {rules.reservationDays} days.
                </li>
              </ul>
              <Link href="/opac/info" className="mt-3 inline-block font-semibold text-sky-800">
                View Details
              </Link>
            </div>
          ) : null}
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm">
            <h2 className="font-semibold">Need Help?</h2>
            <p className="mt-1 text-slate-600">Library Contact</p>
            <ul className="mt-3 space-y-2 text-slate-700">
              {data.settings.contactPhone ? (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> {data.settings.contactPhone}
                </li>
              ) : null}
              {data.settings.contactEmail ? (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> {data.settings.contactEmail}
                </li>
              ) : null}
              {data.address ? (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {data.address}
                </li>
              ) : null}
            </ul>
            {!data.settings.contactPhone && !data.settings.contactEmail && !data.address ? (
              <p className="mt-3 text-slate-500">
                The librarian has not published a public contact yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function BookRow({ title, href, books }: { title: string; href: string; books: OpacBookCard[] }) {
  if (!books.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-sky-800">
          View All
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}
