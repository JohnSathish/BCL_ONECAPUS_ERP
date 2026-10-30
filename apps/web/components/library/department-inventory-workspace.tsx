'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicYears } from '@/services/organization';
import {
  assignLibraryBookDepartment,
  downloadDepartmentInventory,
  fetchCatalogueReportOptions,
  fetchDepartmentBookCopies,
  fetchDepartmentBooks,
  fetchDepartmentInventory,
  fetchDepartmentRegister,
  fetchUnmappedLibraryBooks,
  type DepartmentBookRow,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

type Tab = 'departments' | 'register' | 'unmapped' | 'added';

type Filters = {
  search: string;
  departmentId: string;
  categoryId: string;
  collectionCode: string;
  author: string;
  publisher: string;
  year: string;
  status: string;
  accessionFrom: string;
  accessionTo: string;
  from: string;
  to: string;
};

const EMPTY: Filters = {
  search: '',
  departmentId: '',
  categoryId: '',
  collectionCode: '',
  author: '',
  publisher: '',
  year: '',
  status: '',
  accessionFrom: '',
  accessionTo: '',
  from: '',
  to: '',
};

export function DepartmentInventoryWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('departments');
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>('');
  const [openBook, setOpenBook] = useState<string>('');
  const [picked, setPicked] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState('');
  const [notice, setNotice] = useState('');

  const options = useQuery({
    queryKey: ['library', 'catalogue-reports', 'options'],
    queryFn: fetchCatalogueReportOptions,
    enabled,
  });
  const years = useQuery({
    queryKey: ['organization', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: enabled && tab === 'added',
  });
  const params = cleanParams(applied, tab);
  const summary = useQuery({
    queryKey: ['library', 'department-inventory', params],
    queryFn: () => fetchDepartmentInventory(params),
    enabled,
  });
  const books = useQuery({
    queryKey: ['library', 'department-books', selected || applied.departmentId, params, page],
    queryFn: () =>
      fetchDepartmentBooks({
        ...params,
        departmentId: selected || applied.departmentId || undefined,
        page,
        limit: 20,
      }),
    enabled: enabled && tab === 'departments' && Boolean(selected || applied.departmentId),
  });
  const copies = useQuery({
    queryKey: ['library', 'department-copies', openBook],
    queryFn: () => fetchDepartmentBookCopies(openBook),
    enabled: enabled && Boolean(openBook),
  });
  const register = useQuery({
    queryKey: ['library', 'department-register', params, page],
    queryFn: () => fetchDepartmentRegister({ ...params, page, limit: 25 }),
    enabled:
      enabled && (tab === 'register' || (tab === 'added' && Boolean(applied.from || applied.to))),
  });
  const unmapped = useQuery({
    queryKey: ['library', 'department-unmapped', params, page],
    queryFn: () => fetchUnmappedLibraryBooks({ ...params, page, limit: 20 }),
    enabled: enabled && tab === 'unmapped',
  });
  const assign = useMutation({
    mutationFn: () => assignLibraryBookDepartment({ departmentId: assignTo, bookIds: picked }),
    onSuccess: (result) => {
      setNotice(
        `Linked ${result.linked} title${result.linked === 1 ? '' : 's'} to ${result.department}. Collection codes were left unchanged.`,
      );
      setPicked([]);
      void qc.invalidateQueries({ queryKey: ['library', 'department-inventory'] });
      void qc.invalidateQueries({ queryKey: ['library', 'department-unmapped'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const cards = summary.data?.cards;
  const departmentName =
    summary.data?.departments.find((row) => row.id === (selected || applied.departmentId))?.name ??
    '';

  async function download(format: 'xlsx' | 'csv' | 'pdf') {
    setNotice('');
    try {
      const blob = await downloadDepartmentInventory(format, {
        ...params,
        departmentId: selected || applied.departmentId || undefined,
        scope: tab === 'added' ? 'added' : 'stock',
      });
      downloadBlob(blob, `department-inventory.${format === 'xlsx' ? 'xlsx' : format}`);
    } catch (error) {
      setNotice(apiErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            Library / Reports / Department-Wise Book Inventory
          </p>
          <h1 className="text-xl font-semibold text-slate-900">Department-Wise Book Inventory</h1>
          <p className="text-sm text-slate-500">
            Titles, physical copies, and accession numbers from the library catalogue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void download('xlsx')}>
            Export Excel
          </Button>
          <Button type="button" variant="outline" onClick={() => void download('pdf')}>
            Export PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => void download('csv')}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Departments" value={cards?.departments} hint="ERP departments with books" />
        <Card label="Unique titles" value={cards?.titles} />
        <Card label="Physical copies" value={cards?.copies} />
        <Card label="Available" value={cards?.available} />
        <Card label="Issued" value={cards?.issued} hint="Open loans" />
        <Card label="Lost" value={cards?.lost} />
        <Card label="Damaged" value={cards?.damaged} />
        <Card label="Unmapped titles" value={cards?.unmapped} hint="No ERP department" />
      </div>
      {summary.data?.note ? <p className="text-xs text-slate-500">{summary.data.note}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['departments', 'Department wise'],
            ['register', 'Accession register'],
            ['unmapped', 'Unmapped books'],
            ['added', 'Books added'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${
              tab === id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
            onClick={() => {
              setTab(id);
              setPage(1);
              setOpenBook('');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(draft);
          setSelected(draft.departmentId);
          setPage(1);
          setOpenBook('');
        }}
      >
        <Input
          placeholder="Title, author, or accession"
          value={draft.search}
          onChange={(event) => setDraft({ ...draft, search: event.target.value })}
        />
        <select
          className="h-10 rounded-md border px-2 text-sm"
          value={draft.departmentId}
          onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
        >
          <option value="">All departments</option>
          <option value="unmapped">Unmapped</option>
          {(options.data?.departments ?? []).map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border px-2 text-sm"
          value={draft.categoryId}
          onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
        >
          <option value="">All categories</option>
          {(options.data?.categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border px-2 text-sm"
          value={draft.collectionCode}
          onChange={(event) => setDraft({ ...draft, collectionCode: event.target.value })}
        >
          <option value="">All collection codes</option>
          {(options.data?.collections ?? []).map((collection) => (
            <option key={collection.code} value={collection.code}>
              {collection.code}
            </option>
          ))}
        </select>
        <Input
          placeholder="Author"
          value={draft.author}
          onChange={(event) => setDraft({ ...draft, author: event.target.value })}
        />
        <Input
          placeholder="Publisher"
          value={draft.publisher}
          onChange={(event) => setDraft({ ...draft, publisher: event.target.value })}
        />
        <Input
          placeholder="Publication year"
          value={draft.year}
          onChange={(event) => setDraft({ ...draft, year: event.target.value })}
        />
        <select
          className="h-10 rounded-md border px-2 text-sm"
          value={draft.status}
          onChange={(event) => setDraft({ ...draft, status: event.target.value })}
        >
          <option value="">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="ISSUED">Issued</option>
          <option value="LOST">Lost</option>
          <option value="DAMAGED">Damaged</option>
        </select>
        <Input
          placeholder="Accession from"
          value={draft.accessionFrom}
          onChange={(event) => setDraft({ ...draft, accessionFrom: event.target.value })}
        />
        <Input
          placeholder="Accession to"
          value={draft.accessionTo}
          onChange={(event) => setDraft({ ...draft, accessionTo: event.target.value })}
        />
        <Input
          type="date"
          value={draft.from}
          onChange={(event) => setDraft({ ...draft, from: event.target.value })}
        />
        <Input
          type="date"
          value={draft.to}
          onChange={(event) => setDraft({ ...draft, to: event.target.value })}
        />
        {tab === 'added' ? (
          <select
            className="h-10 rounded-md border px-2 text-sm md:col-span-2"
            onChange={(event) => {
              const year = (years.data ?? []).find((item) => item.id === event.target.value);
              if (!year) return;
              setDraft((current) => ({
                ...current,
                from: year.startDate?.slice(0, 10) ?? current.from,
                to: year.endDate?.slice(0, 10) ?? current.to,
              }));
            }}
            defaultValue=""
          >
            <option value="">Academic year for books added</option>
            {(years.data ?? []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY);
              setApplied(EMPTY);
              setSelected('');
              setPage(1);
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      {notice ? <p className="text-sm text-sky-900">{notice}</p> : null}
      {summary.isError ? (
        <p className="text-sm text-red-700">{apiErrorMessage(summary.error)}</p>
      ) : null}
      {tab === 'added' ? (
        <p className="text-xs text-slate-500">
          This list is the copies whose acquisition date falls in the selected range. It is stock
          evidence for Criterion 4. It is not marked as a NAAC compliance certificate.
        </p>
      ) : null}

      {tab === 'departments' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <section className="overflow-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Department</th>
                  <th>Titles</th>
                  <th>Copies</th>
                  <th>Available</th>
                  <th>Issued</th>
                  <th>Lost</th>
                  <th>Damaged</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(summary.data?.departments ?? []).map((row, index) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="mr-2 text-xs text-slate-400">{index + 1}</span>
                      <span className="font-medium">{row.code}</span> {row.name}
                    </td>
                    <td>{row.titles}</td>
                    <td>{row.copies}</td>
                    <td>{row.available}</td>
                    <td>{row.issued}</td>
                    <td>{row.lost}</td>
                    <td>{row.damaged}</td>
                    <td className="pr-3 text-right">
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700"
                        onClick={() => {
                          setSelected(row.id);
                          setPage(1);
                          setOpenBook('');
                        }}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!summary.data?.departments.length && !summary.isLoading ? (
              <p className="p-4 text-sm text-slate-500">
                No department has catalogue records for these filters.
              </p>
            ) : null}
          </section>
          <section className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">{departmentName || 'Choose a department'}</h2>
            {books.data ? (
              <p className="text-xs text-slate-500">{books.data.total} titles</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {(books.data?.rows ?? []).map((row) => (
                <BookLine
                  key={row.id}
                  row={row}
                  open={openBook === row.id}
                  copies={openBook === row.id ? (copies.data ?? []) : []}
                  onToggle={() => setOpenBook((current) => (current === row.id ? '' : row.id))}
                />
              ))}
              {selected && books.data && !books.data.rows.length ? (
                <p className="text-sm text-slate-500">No titles match these filters.</p>
              ) : null}
            </div>
            <Pager page={page} total={books.data?.total ?? 0} limit={20} onPage={setPage} />
          </section>
        </div>
      ) : null}

      {tab === 'register' || tab === 'added' ? (
        <section className="overflow-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Accession</th>
                <th>Title</th>
                <th>Author</th>
                <th>ISBN</th>
                <th>Status</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {(register.data?.rows ?? []).map((row) => (
                <tr key={`${row.accession}-${row.title}`} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{row.accession || '—'}</td>
                  <td>{row.title}</td>
                  <td>{row.author || '—'}</td>
                  <td>{row.isbn || '—'}</td>
                  <td>{row.displayStatus}</td>
                  <td>{row.department || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tab === 'added' && !applied.from ? (
            <p className="p-4 text-sm text-slate-500">
              Choose an academic year or a date range, then search.
            </p>
          ) : null}
          <Pager page={page} total={register.data?.total ?? 0} limit={25} onPage={setPage} />
        </section>
      ) : null}

      {tab === 'unmapped' ? (
        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="text-sm">
              Assign selected titles
              <select
                className="mt-1 block h-10 rounded-md border px-2"
                value={assignTo}
                onChange={(event) => setAssignTo(event.target.value)}
              >
                <option value="">Choose department</option>
                {(options.data?.departments ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              disabled={!picked.length || !assignTo || assign.isPending}
              onClick={() => assign.mutate()}
            >
              Assign department
            </Button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2" />
                <th>Title</th>
                <th>Author</th>
                <th>Accession</th>
                <th>Koha code</th>
                <th>Copies</th>
              </tr>
            </thead>
            <tbody>
              {(unmapped.data?.rows ?? []).map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={picked.includes(row.id)}
                      onChange={() =>
                        setPicked((current) =>
                          current.includes(row.id)
                            ? current.filter((id) => id !== row.id)
                            : [...current, row.id],
                        )
                      }
                    />
                  </td>
                  <td>{row.title}</td>
                  <td>{row.author || '—'}</td>
                  <td className="font-mono text-xs">{row.accession || '—'}</td>
                  <td>{row.collectionCode || '—'}</td>
                  <td>{row.copies}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!unmapped.data?.rows.length && !unmapped.isLoading ? (
            <p className="py-4 text-sm text-slate-500">No unmapped titles match these filters.</p>
          ) : null}
          <Pager page={page} total={unmapped.data?.total ?? 0} limit={20} onPage={setPage} />
        </section>
      ) : null}
    </div>
  );
}

function BookLine({
  row,
  open,
  copies,
  onToggle,
}: {
  row: DepartmentBookRow;
  open: boolean;
  copies: {
    id: string;
    accession: string;
    displayStatus: string;
    callNumber: string;
    collectionCode: string;
    shelvingLocation: string;
  }[];
  onToggle: () => void;
}) {
  return (
    <article className="rounded-lg border p-3 text-sm">
      <button type="button" className="w-full text-left" onClick={onToggle}>
        <p className="font-medium">{row.title}</p>
        <p className="text-xs text-slate-500">
          {row.author || 'Author not recorded'} · {row.copies} copies · {row.available} available ·{' '}
          {row.issued} issued
          {row.lostDamaged ? ` · ${row.lostDamaged} lost or damaged` : ''}
        </p>
      </button>
      {open ? (
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-slate-500">
              <th>Accession</th>
              <th>Status</th>
              <th>Call number</th>
              <th>Collection</th>
              <th>Shelf</th>
            </tr>
          </thead>
          <tbody>
            {copies.map((copy) => (
              <tr key={copy.id} className="border-t">
                <td className="py-1 font-mono">{copy.accession || '—'}</td>
                <td>{copy.displayStatus}</td>
                <td>{copy.callNumber || '—'}</td>
                <td>{copy.collectionCode || '—'}</td>
                <td>{copy.shelvingLocation || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  );
}

function Card({ label, value, hint }: { label: string; value?: number; hint?: string }) {
  return (
    <section className="rounded-xl border bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold">{value ?? '—'}</p>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </section>
  );
}

function Pager({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(Math.ceil(total / limit), 1);
  if (total <= limit) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function cleanParams(filters: Filters, tab: Tab) {
  const params: Record<string, string | undefined> = {
    search: filters.search || undefined,
    departmentId: filters.departmentId || undefined,
    categoryId: filters.categoryId || undefined,
    collectionCode: filters.collectionCode || undefined,
    author: filters.author || undefined,
    publisher: filters.publisher || undefined,
    year: filters.year || undefined,
    status: filters.status || undefined,
    accessionFrom: filters.accessionFrom || undefined,
    accessionTo: filters.accessionTo || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
  return params;
}
