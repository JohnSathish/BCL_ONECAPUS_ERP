'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import {
  Bell,
  BookOpen,
  Building2,
  ChevronRight,
  Clock3,
  FolderOpen,
  GraduationCap,
  Library,
  Mail,
  MapPin,
  Megaphone,
  MonitorSmartphone,
  Phone,
  Scale,
  Search,
  Star,
  Tags,
  Users,
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
    return <div className="min-h-[70vh] animate-pulse bg-[#0B2B55]/10" aria-hidden />;
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
    [
      Building2,
      'bg-blue-50 text-[#1765F5]',
      'Browse by Department',
      'Titles grouped by department',
      '/opac/departments',
    ],
    [
      BookOpen,
      'bg-emerald-50 text-emerald-600',
      'Browse by Subject',
      'Search the subject headings',
      '/opac/search?field=subject',
    ],
    [
      Tags,
      'bg-violet-50 text-violet-600',
      'Browse by Category',
      'Open the full catalogue',
      '/opac/search',
    ],
    [
      MonitorSmartphone,
      'bg-sky-50 text-sky-600',
      'Digital Library',
      'Published digital resources',
      '/opac/digital',
    ],
    [
      Bell,
      'bg-rose-50 text-rose-500',
      'New Arrivals',
      'Recently added books',
      '/opac/search?sort=recent',
    ],
    [
      Star,
      'bg-amber-50 text-amber-500',
      'Most Popular',
      'Most borrowed titles',
      '/opac/search?sort=borrowed',
    ],
  ] as const;

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden text-white">
        <img
          src="/branding/opac-library-hero.jpg"
          alt="Library shelves"
          className="absolute inset-0 h-full w-full object-cover object-[72%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#061833]/94 via-[#0B2B55]/82 to-[#0B2B55]/45" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-20 pt-10 lg:grid-cols-[1.35fr_0.72fr] lg:items-center lg:pb-24 lg:pt-14">
          <div>
            <p className="text-sm font-medium text-white/90">Welcome to</p>
            <h1 className="mt-2 max-w-xl text-3xl font-extrabold uppercase leading-[1.05] tracking-tight sm:text-5xl">
              {data.collegeName}
            </h1>
            <p className="mt-3 text-lg font-semibold text-white">
              Fr. Battista Busolin Memorial Library
            </p>
            <p className="mt-1 text-sm text-sky-100">Online Public Access Catalogue (OPAC)</p>
            <p className="mt-4 flex max-w-xl gap-2 text-sm leading-relaxed text-slate-100">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB800]" aria-hidden />
              Search, discover and explore the library collection of books, journals, reference
              materials and digital resources.
            </p>
            <form
              onSubmit={(event) => search(event)}
              className="mt-6 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row sm:items-center sm:rounded-full sm:p-1.5"
            >
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Search by book title, author, ISBN, subject, accession number..."
                  className="h-12 w-full rounded-full border-0 bg-transparent pl-10 pr-3 text-sm text-[#14213D] outline-none"
                />
              </label>
              <select
                value={field}
                onChange={(event) => setField(event.target.value as (typeof fields)[number][0])}
                aria-label="Search field"
                className="h-11 rounded-full border border-[#DCE5F0] bg-white px-3 text-sm text-[#14213D]"
              >
                {fields.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1765F5] px-5 text-sm font-semibold text-white hover:bg-[#0f52d4]"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
              <span className="font-semibold text-white/80">Popular Searches:</span>
              {chips.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    field === value
                      ? 'bg-white text-[#0B2B55]'
                      : 'text-white/90 underline-offset-2 hover:underline'
                  }`}
                  onClick={() => setField(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div id="library-login" className="rounded-2xl bg-white p-5 text-[#14213D] shadow-2xl">
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
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#1765F5]">
                    <BookOpen className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <h2 className="text-lg font-bold">Login to Your Library Account</h2>
                    <p className="text-sm text-[#64748B]">
                      Students and staff use the same college credentials.
                    </p>
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {(['student', 'staff'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${
                        member === kind ? 'bg-[#1765F5] text-white' : 'bg-[#F3F7FC] text-[#64748B]'
                      }`}
                      onClick={() => setMember(kind)}
                    >
                      {kind === 'student' ? (
                        <GraduationCap className="h-4 w-4" aria-hidden />
                      ) : (
                        <Users className="h-4 w-4" aria-hidden />
                      )}
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
                  <Link href="/opac/info#help" className="font-semibold text-sky-800">
                    Login Help
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4">
        <section className="relative z-10 -mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {counts.map(([Icon, tone, value, label]) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-[#DCE5F0] bg-white px-4 py-4 shadow-sm"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tone}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-xl font-extrabold text-[#14213D]">
                  {value.toLocaleString('en-IN')}
                </span>
                <span className="block text-xs text-[#64748B]">{label}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {tiles.map(([Icon, tone, title, caption, href]) => (
            <Link
              key={title}
              href={href}
              className="group flex items-center gap-3 rounded-2xl border border-[#DCE5F0] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#14213D]">{title}</span>
                <span className="block truncate text-xs text-[#64748B]">{caption}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8] transition group-hover:translate-x-0.5 group-hover:text-[#1765F5]" />
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
