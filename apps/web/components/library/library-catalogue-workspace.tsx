'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  Library,
  MoreVertical,
  Plus,
  Search,
  Table2,
  Upload,
  Users,
} from 'lucide-react';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  libraryFilterControlClass,
  libraryFilterLabelClass,
  librarySearchButtonClass,
  librarySearchInputClass,
  librarySearchPanelClass,
} from '@/components/library/library-search-panel';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  downloadCatalogueReport,
  fetchLibraryCatalogueOptions,
  fetchLibraryCatalogueSummary,
  fetchLibraryBook,
  fetchLibraryBooks,
  updateLibraryBook,
} from '@/services/library';
import { CopyCirculationEditor } from './library-copy-editor';
import type { LibraryBook } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';
import { cn } from '@/utils/cn';

type Availability = 'ALL' | 'AVAILABLE' | 'ISSUED' | 'RESERVED' | 'LOST';
type SortKey = 'accession' | 'title' | 'author' | 'department' | 'year' | 'copies' | 'available';

type Filters = {
  search: string;
  departmentId: string;
  categoryId: string;
  subject: string;
  language: string;
  year: string;
  availability: Availability;
  sort: SortKey;
  sortDir: 'asc' | 'desc';
  page: number;
  limit: number;
};

const EMPTY: Filters = {
  search: '',
  departmentId: '',
  categoryId: '',
  subject: '',
  language: '',
  year: '',
  availability: 'ALL',
  sort: 'accession',
  sortDir: 'asc',
  page: 1,
  limit: 20,
};

const TABS: {
  id: Availability;
  label: string;
  count?: 'all' | 'available' | 'borrowed' | 'reserved';
}[] = [
  { id: 'ALL', label: 'All Books', count: 'all' },
  { id: 'AVAILABLE', label: 'Available Books', count: 'available' },
  { id: 'ISSUED', label: 'Borrowed Books', count: 'borrowed' },
  { id: 'RESERVED', label: 'Reserved Books', count: 'reserved' },
];

function num(value?: number | null) {
  if (value == null) return '—';
  return value.toLocaleString('en-IN');
}

function statusOf(book: LibraryBook) {
  if ((book.availableCopies ?? 0) > 0)
    return { label: 'Available', tone: 'bg-emerald-50 text-emerald-700' };
  if ((book.issuedCopies ?? 0) > 0)
    return { label: 'Borrowed', tone: 'bg-amber-50 text-amber-800' };
  return { label: book.copies?.[0]?.status || 'Unavailable', tone: 'bg-slate-100 text-slate-600' };
}

export function LibraryCatalogueWorkspace() {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const qc = useQueryClient();
  const canManage = canAny('library:manage');
  const canExport = canAny('library:reports', 'library:manage', 'library:read');
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  useEffect(() => {
    const search = new URLSearchParams(window.location.search).get('search')?.trim();
    if (!search) return;
    setDraft((current) => ({ ...current, search }));
    setFilters((current) => ({ ...current, search, page: 1 }));
  }, []);
  const [advanced, setAdvanced] = useState(true);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [selected, setSelected] = useState<string[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LibraryBook | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    edition: '',
  });
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);

  const summary = useQuery({
    queryKey: ['library', 'catalogue-summary'],
    queryFn: fetchLibraryCatalogueSummary,
    enabled,
  });
  const options = useQuery({
    queryKey: ['library', 'catalogue-options'],
    queryFn: fetchLibraryCatalogueOptions,
    enabled,
  });
  const books = useQuery({
    queryKey: ['library', 'catalogue', filters],
    queryFn: () =>
      fetchLibraryBooks({
        search: filters.search || undefined,
        departmentId: filters.departmentId || undefined,
        categoryId: filters.categoryId || undefined,
        subject: filters.subject || undefined,
        language: filters.language || undefined,
        year: filters.year || undefined,
        availability: filters.availability,
        sort: filters.sort,
        sortDir: filters.sortDir,
        page: filters.page,
        limit: filters.limit,
        facets: 'true',
      }),
    enabled,
  });

  const saveMut = useMutation({
    mutationFn: () => updateLibraryBook(detail!.id, editForm),
    onSuccess: () => {
      setNotice('Book details saved. The accession number was not changed.');
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ['library', 'catalogue'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const items = books.data?.items ?? [];
  const total = books.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / filters.limit));
  const pageIds = items.map((book) => book.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function apply(next: Partial<Filters>) {
    const merged = { ...draft, ...filters, ...next, page: next.page ?? 1 };
    setDraft(merged);
    setFilters(merged);
    setSelected([]);
  }

  async function exportBooks(scope: 'selected' | 'filtered') {
    setExporting(true);
    try {
      const blob = await downloadCatalogueReport('catalogue', 'xlsx', {
        search: filters.search || undefined,
        departmentId: filters.departmentId || undefined,
        categoryId: filters.categoryId || undefined,
        subject: filters.subject || undefined,
        language: filters.language || undefined,
        year: filters.year || undefined,
        status:
          filters.availability === 'AVAILABLE' ||
          filters.availability === 'ISSUED' ||
          filters.availability === 'LOST'
            ? filters.availability
            : undefined,
        bookIds: scope === 'selected' ? selected.join(',') : undefined,
      });
      downloadBlob(
        blob,
        scope === 'selected' ? 'catalogue-selected.xlsx' : 'catalogue-filtered.xlsx',
      );
      setNotice(
        scope === 'selected'
          ? 'Exported the physical copies of the selected titles.'
          : 'Exported physical copies matching the current filters. Each row is one copy.',
      );
    } catch (error) {
      setNotice(apiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  function openBook(book: LibraryBook, edit = false) {
    setDetail(book);
    void fetchLibraryBook(book.id)
      .then((full) => setDetail(full))
      .catch(() => setDetail(book));
    setEditing(edit);
    setMenuId(null);
    setEditForm({
      title: book.title,
      author: book.author ?? '',
      isbn: book.isbn ?? '',
      publisher: book.publisher ?? '',
      edition: book.edition ?? '',
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Library className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Library / Catalogue</p>
            <h1 className="text-xl font-semibold text-slate-900">Library Catalogue</h1>
            <p className="text-sm text-slate-500">
              Search, browse and manage the library collection
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button variant="outline" asChild>
              <Link href="/admin/library/koha-import">
                <Upload className="mr-2 h-4 w-4" />
                Import Books
              </Link>
            </Button>
          ) : null}
          {canExport ? (
            <Button
              variant="outline"
              disabled={exporting}
              onClick={() => void exportBooks('filtered')}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          ) : null}
          {canManage ? (
            <Button asChild>
              <Link href="/admin/library/accession">
                <Plus className="mr-2 h-4 w-4" />
                Add New Book
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</p>
      ) : null}
      {books.isError ? (
        <QueryErrorPanel
          title="Unable to load the catalogue"
          error={books.error}
          onRetry={() => void books.refetch()}
          isRetrying={books.isFetching}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card
          icon={BookOpen}
          label="Total Books (Copies)"
          value={num(summary.data?.copies)}
          hint="Physical copies"
          tone="bg-blue-50 text-blue-700"
          href="/admin/library/collection-reports?report=total-copies"
        />
        <Card
          icon={Library}
          label="Unique Titles"
          value={num(summary.data?.titles)}
          hint="Bibliographic records"
          tone="bg-emerald-50 text-emerald-700"
          href="/admin/library/collection-reports?report=total-titles"
        />
        <Card
          icon={Users}
          label="Authors"
          value={num(summary.data?.authors)}
          hint="Distinct primary authors"
          tone="bg-violet-50 text-violet-700"
        />
        <Card
          icon={BookOpen}
          label="Subjects / Categories"
          value={num(summary.data?.categories)}
          hint="Configured categories"
          tone="bg-amber-50 text-amber-800"
        />
        <Card
          icon={Library}
          label="Departments"
          value={num(summary.data?.departments)}
          hint="Departments with titles"
          tone="bg-rose-50 text-rose-700"
          href="/admin/library/collection-reports?report=department-summary"
        />
      </div>

      <section className={librarySearchPanelClass}>
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ search: draft.search, page: 1 });
          }}
        >
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input
              className={librarySearchInputClass}
              placeholder="Search by title, author, accession no., ISBN, subject..."
              value={draft.search}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
            />
          </div>
          <Button type="submit" className={librarySearchButtonClass}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button type="button" variant="outline" onClick={() => setAdvanced((value) => !value)}>
            Advanced Filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY);
              setFilters(EMPTY);
              setSelected([]);
            }}
          >
            Clear
          </Button>
        </form>
        {advanced ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Select
              label="Department"
              value={filters.departmentId}
              onChange={(departmentId) => apply({ departmentId })}
            >
              <option value="">All Departments</option>
              {(options.data?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select
              label="Book Category"
              value={filters.categoryId}
              onChange={(categoryId) => apply({ categoryId })}
            >
              <option value="">All Categories</option>
              {(options.data?.categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              label="Subject"
              value={filters.subject}
              onChange={(subject) => apply({ subject })}
            >
              <option value="">All Subjects</option>
              {(options.data?.subjects ?? []).map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </Select>
            <Select
              label="Language"
              value={filters.language}
              onChange={(language) => apply({ language })}
            >
              <option value="">All Languages</option>
              {(options.data?.languages ?? []).map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </Select>
            <Select
              label="Publication Year"
              value={filters.year}
              onChange={(year) => apply({ year })}
            >
              <option value="">All Years</option>
              {(options.data?.years ?? []).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
            <Select
              label="Availability"
              value={filters.availability}
              onChange={(availability) => apply({ availability: availability as Availability })}
            >
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="ISSUED">Borrowed</option>
              <option value="RESERVED">Reserved</option>
              <option value="LOST">Lost or damaged</option>
            </Select>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                filters.availability === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200',
              )}
              onClick={() => apply({ availability: tab.id })}
            >
              {tab.label}
              {books.data?.facets && tab.count ? ` (${num(books.data.facets[tab.count])})` : ''}
            </button>
          ))}
          <Link
            href="/admin/library/digital"
            className="rounded-lg bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200"
          >
            Digital Resources
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              'rounded-lg p-2',
              view === 'table' ? 'bg-blue-600 text-white' : 'bg-white ring-1 ring-slate-200',
            )}
            onClick={() => setView('table')}
            aria-label="Table view"
          >
            <Table2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(
              'rounded-lg p-2',
              view === 'grid' ? 'bg-blue-600 text-white' : 'bg-white ring-1 ring-slate-200',
            )}
            onClick={() => setView('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={`${filters.sort}:${filters.sortDir}`}
            onChange={(event) => {
              const [sort, sortDir] = event.target.value.split(':') as [SortKey, 'asc' | 'desc'];
              apply({ sort, sortDir });
            }}
          >
            <option value="accession:asc">Accession (A–Z)</option>
            <option value="title:asc">Title (A–Z)</option>
            <option value="author:asc">Author (A–Z)</option>
            <option value="department:asc">Department (A–Z)</option>
            <option value="year:desc">Publication year</option>
            <option value="copies:desc">Total copies</option>
            <option value="available:desc">Available copies</option>
          </select>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm text-slate-500">
          <span>
            {total
              ? `Showing ${books.data?.from ?? 0}–${books.data?.to ?? 0} of ${num(total)} titles`
              : books.isLoading
                ? 'Loading titles…'
                : 'No titles match these filters.'}
          </span>
          <div className="flex items-center gap-2">
            {canExport && selected.length ? (
              <Button
                size="sm"
                variant="outline"
                disabled={exporting}
                onClick={() => void exportBooks('selected')}
              >
                Export selected ({selected.length})
              </Button>
            ) : null}
            <label>
              Show
              <select
                className="mx-2 rounded-md border px-2 py-1"
                value={filters.limit}
                onChange={(event) => apply({ limit: Number(event.target.value) })}
              >
                {[20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              per page
            </label>
          </div>
        </div>
        {view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select this page"
                      checked={allPageSelected}
                      onChange={() => setSelected(allPageSelected ? [] : pageIds)}
                    />
                  </th>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Accession No.</th>
                  <th className="px-3 py-2">Book Title</th>
                  <th className="px-3 py-2">Author</th>
                  <th className="px-3 py-2">Subject / Category</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Copies</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((book, index) => {
                  const status = statusOf(book);
                  return (
                    <tr key={book.id} className="border-t">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${book.title}`}
                          checked={selected.includes(book.id)}
                          onChange={() =>
                            setSelected((current) =>
                              current.includes(book.id)
                                ? current.filter((id) => id !== book.id)
                                : [...current, book.id],
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {(filters.page - 1) * filters.limit + index + 1}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {book.copies?.[0]?.accessionNumber || book.accessionNo}
                      </td>
                      <td className="max-w-[240px] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Cover book={book} />
                          <span className="line-clamp-2 font-medium" title={book.title}>
                            {book.title}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[160px] px-3 py-2">
                        <span className="line-clamp-2" title={book.author ?? ''}>
                          {book.author || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2">{book.subject || book.category?.name || '—'}</td>
                      <td className="px-3 py-2">{book.departmentName || '—'}</td>
                      <td className="px-3 py-2">{book.publicationYear || '—'}</td>
                      <td className="px-3 py-2">{book.copyCount ?? book.totalCopies}</td>
                      <td className="px-3 py-2">{book.availableCopies ?? 0}</td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs', status.tone)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="relative px-3 py-2">
                        <button
                          type="button"
                          aria-label="Book actions"
                          className="rounded p-1 hover:bg-slate-100"
                          onClick={() => setMenuId(menuId === book.id ? null : book.id)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuId === book.id ? (
                          <BookMenu book={book} canManage={canManage} onOpen={openBook} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((book) => {
              const status = statusOf(book);
              return (
                <article key={book.id} className="rounded-xl border p-3">
                  <Cover book={book} large />
                  <h3 className="mt-2 line-clamp-2 font-medium" title={book.title}>
                    {book.title}
                  </h3>
                  <p className="text-sm text-slate-500">{book.author || '—'}</p>
                  <p className="text-xs text-slate-500">
                    {book.departmentName || book.subject || book.category?.name || '—'}
                  </p>
                  <p className="mt-1 text-sm">
                    {book.availableCopies ?? 0} available of {book.copyCount ?? book.totalCopies}
                  </p>
                  <span
                    className={cn('mt-2 inline-flex rounded-full px-2 py-0.5 text-xs', status.tone)}
                  >
                    {status.label}
                  </span>
                  <Button
                    className="mt-3 w-full"
                    variant="outline"
                    size="sm"
                    onClick={() => openBook(book)}
                  >
                    View Details
                  </Button>
                </article>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => apply({ page: filters.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            {filters.page} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= pages}
            onClick={() => apply({ page: filters.page + 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{detail.title}</h3>
            {editing && canManage ? (
              <form
                className="mt-3 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveMut.mutate();
                }}
              >
                <Input
                  value={editForm.title}
                  onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                  placeholder="Title"
                />
                <Input
                  value={editForm.author}
                  onChange={(event) => setEditForm({ ...editForm, author: event.target.value })}
                  placeholder="Author"
                />
                <Input
                  value={editForm.isbn}
                  onChange={(event) => setEditForm({ ...editForm, isbn: event.target.value })}
                  placeholder="ISBN"
                />
                <Input
                  value={editForm.publisher}
                  onChange={(event) => setEditForm({ ...editForm, publisher: event.target.value })}
                  placeholder="Publisher"
                />
                <Input
                  value={editForm.edition}
                  onChange={(event) => setEditForm({ ...editForm, edition: event.target.value })}
                  placeholder="Edition"
                />
                <p className="text-xs text-slate-500">
                  Accession numbers stay on the Book Accession page.
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveMut.isPending}>
                    Save
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Field label="Author" value={detail.author || '—'} />
                  <Field label="ISBN" value={detail.isbn || '—'} />
                  <Field label="Subject" value={detail.subject || '—'} />
                  <Field label="Category" value={detail.category?.name || '—'} />
                  <Field label="Department" value={detail.departmentName || '—'} />
                  <Field label="Year" value={detail.publicationYear || '—'} />
                  <Field label="Copies" value={String(detail.copyCount ?? detail.totalCopies)} />
                  <Field label="Available" value={String(detail.availableCopies ?? 0)} />
                </dl>
                <CopyCirculationEditor
                  book={detail}
                  canManage={canManage}
                  onUpdated={(book) => setDetail(book)}
                />
              </>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              {canManage && !editing ? (
                <Button onClick={() => setEditing(true)}>Edit Book Details</Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BookMenu({
  book,
  canManage,
  onOpen,
}: {
  book: LibraryBook;
  canManage: boolean;
  onOpen: (book: LibraryBook, edit?: boolean) => void;
}) {
  return (
    <div className="absolute right-3 z-10 w-48 rounded-lg border bg-white p-1 text-left shadow-lg">
      <button
        type="button"
        className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50"
        onClick={() => onOpen(book)}
      >
        View Details
      </button>
      {canManage ? (
        <button
          type="button"
          className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50"
          onClick={() => onOpen(book, true)}
        >
          Edit Book Details
        </button>
      ) : null}
      <button
        type="button"
        className="block w-full rounded px-2 py-1.5 text-left hover:bg-slate-50"
        onClick={() => onOpen(book)}
      >
        View Physical Copies
      </button>
      <Link className="block rounded px-2 py-1.5 hover:bg-slate-50" href="/admin/library/barcodes">
        Print Barcode
      </Link>
      <Link className="block rounded px-2 py-1.5 hover:bg-slate-50" href="/admin/library/accession">
        Open Book Accession
      </Link>
    </div>
  );
}

function Cover({ book, large = false }: { book: LibraryBook; large?: boolean }) {
  if (book.coverImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={book.coverImageUrl}
        alt=""
        className={cn('rounded object-cover', large ? 'h-36 w-full' : 'h-10 w-8')}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded bg-slate-100 text-slate-400',
        large ? 'h-36 w-full' : 'h-10 w-8',
      )}
    >
      <BookOpen className="h-4 w-4" />
    </span>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  href,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  hint: string;
  tone: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-slate-400">{hint}</p>
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className={libraryFilterLabelClass}>
      {label}
      <select
        className={`mt-1.5 ${libraryFilterControlClass}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
