'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Printer, Search } from 'lucide-react';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  bulkClearanceCards,
  createClearanceCard,
  downloadClearancePdf,
  fetchClearanceCard,
  fetchClearanceHistory,
  fetchClearanceOptions,
  fetchClearancePreview,
  fetchClearancePrintHtml,
  fetchClearanceRecords,
  recheckClearanceCard,
  regenerateClearanceCard,
  searchClearanceStudents,
  updateClearanceCard,
} from '@/services/library-clearance';
import type { ClearanceDecision, ClearanceRow } from '@/types/library-clearance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const control = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

type DialogState = {
  mode: 'view' | 'edit';
  studentId: string;
  cardId: string | null;
  academicYear: string;
  examinationName: string;
  semester: string;
};

type FormState = {
  status: 'PENDING' | 'CLEARED';
  booksReturned: 'YES' | 'NO';
  duesStatus: 'CLEARED' | 'PENDING';
  lostDamagedStatus: 'CLEARED' | 'PENDING';
  accountStatus: 'CLEARED' | 'NOT_CLEARED';
  remarks: string;
  librarianName: string;
  clearedOn: string;
};

const emptyForm: FormState = {
  status: 'PENDING',
  booksReturned: 'YES',
  duesStatus: 'CLEARED',
  lostDamagedStatus: 'CLEARED',
  accountStatus: 'CLEARED',
  remarks: '',
  librarianName: '',
  clearedOn: '',
};

function statusLabel(status: string) {
  if (status === 'CLEARED') return 'Cleared';
  if (status === 'PENDING') return 'Pending';
  return 'Not yet processed';
}

function decisionError(form: FormState) {
  const clear =
    form.booksReturned === 'YES' &&
    form.duesStatus === 'CLEARED' &&
    form.lostDamagedStatus === 'CLEARED' &&
    form.accountStatus === 'CLEARED';
  if (form.status === 'CLEARED' && !clear) {
    return 'A cleared card needs every verification line marked clear.';
  }
  if (form.status === 'CLEARED' && !form.librarianName.trim()) {
    return "Enter the librarian's name before marking the card cleared.";
  }
  if (form.status === 'PENDING' && !form.remarks.trim()) {
    return 'Add a remark explaining why clearance is pending.';
  }
  return null;
}

export function LibraryClearanceWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const { canAny } = usePermissions();
  const canWrite = canAny('library:circulate', 'library:manage');
  const [academicYear, setAcademicYear] = useState('');
  const [examinationName, setExaminationName] = useState('');
  const [semester, setSemester] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [programId, setProgramId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [finder, setFinder] = useState('');
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState<'single' | 'pair'>('single');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const seededYear = useRef(false);
  const seededForm = useRef('');

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const options = useQuery({
    queryKey: ['library-clearance', 'options'],
    queryFn: fetchClearanceOptions,
    enabled,
  });

  useEffect(() => {
    if (seededYear.current || !options.data) return;
    const current =
      options.data.academicYears.find(
        (year) => year.isPrimarySession || year.status === 'ACTIVE',
      ) ?? options.data.academicYears[0];
    if (current) setAcademicYear(current.name);
    seededYear.current = true;
  }, [options.data]);

  const params = useMemo(
    () => ({
      page,
      limit: 25,
      ...(search ? { search } : {}),
      ...(academicYear ? { academicYear } : {}),
      ...(examinationName.trim() ? { examinationName: examinationName.trim() } : {}),
      ...(semester ? { semester: Number(semester) } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(programId ? { programId } : {}),
      status,
    }),
    [academicYear, departmentId, examinationName, page, programId, search, semester, status],
  );

  const records = useQuery({
    queryKey: ['library-clearance', 'records', params],
    queryFn: () => fetchClearanceRecords(params),
    enabled,
  });

  const finderQuery = useQuery({
    queryKey: ['library-clearance', 'finder', finder],
    queryFn: () => searchClearanceStudents(finder),
    enabled: enabled && finder.trim().length >= 2,
  });

  const preview = useQuery({
    queryKey: [
      'library-clearance',
      'preview',
      dialog?.studentId,
      dialog?.academicYear,
      dialog?.examinationName,
      dialog?.semester,
    ],
    queryFn: () =>
      fetchClearancePreview(dialog!.studentId, {
        ...(dialog!.academicYear ? { academicYear: dialog!.academicYear } : {}),
        ...(dialog!.examinationName.trim()
          ? { examinationName: dialog!.examinationName.trim() }
          : {}),
        ...(dialog!.semester ? { semester: Number(dialog!.semester) } : {}),
      }),
    enabled: enabled && Boolean(dialog?.studentId),
  });

  const detail = useQuery({
    queryKey: ['library-clearance', 'card', dialog?.cardId],
    queryFn: () => fetchClearanceCard(dialog!.cardId!),
    enabled: enabled && Boolean(dialog?.cardId),
  });

  const history = useQuery({
    queryKey: ['library-clearance', 'history', dialog?.studentId],
    queryFn: () => fetchClearanceHistory(dialog!.studentId),
    enabled: enabled && Boolean(dialog?.studentId),
  });

  useEffect(() => {
    if (!dialog) return;
    const key = `${dialog.studentId}:${dialog.cardId}:${dialog.mode}`;
    if (seededForm.current === key) return;
    if (dialog.cardId) {
      if (!detail.data || detail.data.id !== dialog.cardId) return;
      setForm({
        status: detail.data.status === 'CLEARED' ? 'CLEARED' : 'PENDING',
        booksReturned: detail.data.booksReturned === 'NO' ? 'NO' : 'YES',
        duesStatus: detail.data.duesStatus === 'PENDING' ? 'PENDING' : 'CLEARED',
        lostDamagedStatus: detail.data.lostDamagedStatus === 'PENDING' ? 'PENDING' : 'CLEARED',
        accountStatus: detail.data.accountStatus === 'NOT_CLEARED' ? 'NOT_CLEARED' : 'CLEARED',
        remarks: detail.data.remarks ?? '',
        librarianName: detail.data.librarianName ?? options.data?.librarianName ?? '',
        clearedOn: detail.data.clearedOn ?? '',
      });
      seededForm.current = key;
      return;
    }
    if (!preview.data) return;
    const library = preview.data.library;
    setForm({
      status: library.status,
      booksReturned: library.booksReturned,
      duesStatus: library.duesStatus,
      lostDamagedStatus: library.lostDamagedStatus,
      accountStatus: library.accountStatus,
      remarks: library.suggestedRemarks ?? '',
      librarianName: options.data?.librarianName ?? '',
      clearedOn: library.status === 'CLEARED' ? new Date().toISOString().slice(0, 10) : '',
    });
    seededForm.current = key;
  }, [detail.data, dialog, options.data?.librarianName, preview.data]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['library-clearance', 'records'] });
    void qc.invalidateQueries({ queryKey: ['library-clearance', 'history'] });
    void qc.invalidateQueries({ queryKey: ['library-clearance', 'preview'] });
    void qc.invalidateQueries({ queryKey: ['library-clearance', 'card'] });
    void qc.invalidateQueries({ queryKey: ['library-clearance', 'options'] });
  }

  function openStudent(studentId: string, cardId: string | null, mode: 'view' | 'edit') {
    seededForm.current = '';
    setDialog({
      mode,
      studentId,
      cardId,
      academicYear,
      examinationName,
      semester: semester || '',
    });
    setFinder('');
  }

  function openRow(row: ClearanceRow, mode: 'view' | 'edit') {
    seededForm.current = '';
    setDialog({
      mode,
      studentId: row.studentId,
      cardId: row.id,
      academicYear: row.academicYear || academicYear,
      examinationName: row.examinationName || examinationName,
      semester: String(row.semester || semester || ''),
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!dialog) throw new Error('Choose a student first.');
      const problem = decisionError(form);
      if (problem) throw new Error(problem);
      if (!dialog.academicYear.trim() || !dialog.examinationName.trim() || !dialog.semester) {
        throw new Error('Academic year, examination name and semester are required.');
      }
      const payload: ClearanceDecision = {
        status: form.status,
        booksReturned: form.booksReturned,
        duesStatus: form.duesStatus,
        lostDamagedStatus: form.lostDamagedStatus,
        accountStatus: form.accountStatus,
        remarks: form.remarks.trim(),
        librarianName: form.librarianName.trim(),
        ...(form.clearedOn ? { clearedOn: form.clearedOn } : {}),
      };
      if (dialog.cardId) return updateClearanceCard(dialog.cardId, payload);
      return createClearanceCard({
        ...payload,
        studentId: dialog.studentId,
        academicYear: dialog.academicYear.trim(),
        examinationName: dialog.examinationName.trim(),
        semester: Number(dialog.semester),
      });
    },
    onSuccess: (card) => {
      setNotice(`Clearance card ${card.cardNumber} saved.`);
      seededForm.current = '';
      setDialog((current) =>
        current
          ? { ...current, mode: 'view', cardId: card.id, semester: String(card.semester) }
          : current,
      );
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const recheck = useMutation({
    mutationFn: (id: string) => recheckClearanceCard(id),
    onSuccess: (card) => {
      setNotice(`Library records rechecked for ${card.cardNumber}.`);
      seededForm.current = '';
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const regenerate = useMutation({
    mutationFn: (id: string) => regenerateClearanceCard(id),
    onSuccess: (card) => {
      setNotice(`Student details refreshed on ${card.cardNumber}.`);
      seededForm.current = '';
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  const bulk = useMutation({
    mutationFn: (studentIds?: string[]) => {
      if (!academicYear || !examinationName.trim() || !semester) {
        throw new Error('Choose the academic year, examination name and semester first.');
      }
      return bulkClearanceCards({
        academicYear,
        examinationName: examinationName.trim(),
        semester: Number(semester),
        ...(studentIds?.length ? { studentIds } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(programId ? { programId } : {}),
        ...(options.data?.librarianName ? { librarianName: options.data.librarianName } : {}),
      });
    },
    onSuccess: (result) => {
      const cap = result.capped ? ' The first 400 students were processed.' : '';
      setNotice(
        `Created ${result.created} card${result.created === 1 ? '' : 's'} (${result.cleared} cleared, ${result.pending} pending). Skipped ${result.skipped}.${cap}`,
      );
      setSelectedStudents([]);
      refresh();
    },
    onError: (error) => setNotice(apiErrorMessage(error)),
  });

  async function printCards(ids: string[]) {
    if (!ids.length) {
      setNotice('Select a saved clearance card to print.');
      return;
    }
    try {
      const { html } = await fetchClearancePrintHtml({ ids, layout, autoPrint: true });
      const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
      if (!popup) {
        setNotice('Allow pop-ups to print the clearance card.');
        return;
      }
      popup.document.write(html);
      popup.document.close();
    } catch (error) {
      setNotice(apiErrorMessage(error));
    }
  }

  async function downloadCards(ids: string[]) {
    if (!ids.length) {
      setNotice('Select a saved clearance card to download.');
      return;
    }
    try {
      const blob = await downloadClearancePdf({ ids, layout });
      downloadBlob(
        blob,
        ids.length === 1 ? 'library-clearance-card.pdf' : 'library-clearance-cards.pdf',
      );
    } catch (error) {
      setNotice(apiErrorMessage(error));
    }
  }

  const summary = records.data?.summary;
  const rows = records.data?.rows ?? [];
  const total = records.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));
  const contextReady = Boolean(academicYear && examinationName.trim() && semester);
  const student = preview.data?.student;
  const library = preview.data?.library;

  function toggleCard(id: string) {
    setSelectedCards((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleStudent(id: string) {
    setSelectedStudents((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Library Clearance Card</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Confirm that a student has returned borrowed books and settled library dues, then print
          the clearance card for the examination they are sitting. Each academic year, examination
          and semester keeps its own record.
        </p>
      </div>

      {notice ? (
        <div
          className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="clearance-finder">
          Find a student by college roll number or name
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="clearance-finder"
            value={finder}
            onChange={(event) => setFinder(event.target.value)}
            placeholder="Roll number or student name"
            className="pl-9"
          />
        </div>
        {finder.trim().length >= 2 ? (
          <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border">
            {finderQuery.isLoading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Searching students…</p>
            ) : finderQuery.data?.length ? (
              finderQuery.data.map((hit) => (
                <button
                  key={hit.studentId}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                  onClick={() => openStudent(hit.studentId, null, canWrite ? 'edit' : 'view')}
                >
                  <span>
                    <span className="font-medium">{hit.studentName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {hit.rollNumber || 'No roll number'} ·{' '}
                      {hit.programme || 'Programme not recorded'} ·{' '}
                      {hit.department || 'Department not recorded'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Sem {ROMAN[hit.currentSemester] || hit.currentSemester}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matching student.</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total students" value={summary?.totalStudents} />
        <Stat label="Clearance completed" value={summary?.cleared} />
        <Stat label="Clearance pending" value={summary?.pending} />
        <Stat label="Not yet processed" value={summary?.notYetProcessed} />
      </section>
      {records.data && !records.data.contextReady ? (
        <p className="text-sm text-muted-foreground">
          Choose an academic year, examination name and semester to count students who have not been
          processed. Not-yet-processed students are those currently in the selected semester.
        </p>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Filter label="Academic year">
          <select
            className={control}
            value={academicYear}
            onChange={(event) => {
              setPage(1);
              setAcademicYear(event.target.value);
            }}
          >
            <option value="">All years</option>
            {options.data?.academicYears.map((year) => (
              <option key={year.id} value={year.name}>
                {year.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Examination name">
          <input
            className={control}
            list="clearance-examinations"
            value={examinationName}
            onChange={(event) => {
              setPage(1);
              setExaminationName(event.target.value);
            }}
            placeholder="FYUGP 3rd Semester Examination"
          />
          <datalist id="clearance-examinations">
            {options.data?.examinations.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Filter>
        <Filter label="Semester">
          <select
            className={control}
            value={semester}
            onChange={(event) => {
              setPage(1);
              setSemester(event.target.value);
            }}
          >
            <option value="">All semesters</option>
            {(options.data?.semesters ?? [1, 2, 3, 4, 5, 6, 7, 8]).map((item) => (
              <option key={item} value={item}>
                {ROMAN[item] || item}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Department">
          <select
            className={control}
            value={departmentId}
            onChange={(event) => {
              setPage(1);
              setDepartmentId(event.target.value);
            }}
          >
            <option value="">All departments</option>
            {options.data?.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Programme">
          <select
            className={control}
            value={programId}
            onChange={(event) => {
              setPage(1);
              setProgramId(event.target.value);
            }}
          >
            <option value="">All programmes</option>
            {options.data?.programmes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Clearance status">
          <select
            className={control}
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            <option value="ALL">All</option>
            <option value="CLEARED">Cleared</option>
            <option value="PENDING">Pending</option>
            <option value="NOT_PROCESSED">Not yet processed</option>
          </select>
        </Filter>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchInput}
          onChange={(event) => {
            setPage(1);
            setSearchInput(event.target.value);
          }}
          placeholder="Search name, roll, registration or card number"
          className="max-w-sm"
        />
        <select
          className={cn(control, 'w-auto')}
          value={layout}
          onChange={(event) => setLayout(event.target.value as 'single' | 'pair')}
        >
          <option value="single">1 card per A4</option>
          <option value="pair">2 cards per A4</option>
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void printCards(selectedCards)}
        >
          <Printer className="mr-1.5 h-3.5 w-3.5" /> Print selected
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void downloadCards(selectedCards)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
        </Button>
        {canWrite ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedStudents.length || bulk.isPending}
              onClick={() => bulk.mutate(selectedStudents)}
            >
              Generate selected
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!contextReady || bulk.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    'Generate clearance cards for students in this semester who do not have one yet? Up to 400 cards are created at a time.',
                  )
                )
                  return;
                bulk.mutate(undefined);
              }}
            >
              Generate pending cohort
            </Button>
          </>
        ) : null}
      </div>

      {records.isError ? (
        <QueryErrorPanel
          title="Unable to load clearance records"
          error={records.error}
          onRetry={() => void records.refetch()}
          isRetrying={records.isFetching}
        />
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Student</th>
              <th className="px-3 py-2 font-medium">Roll no.</th>
              <th className="px-3 py-2 font-medium">Programme</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Sem</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Card no.</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.isLoading ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-muted-foreground">
                  Loading clearance records…
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.id ?? row.studentId} className="border-t border-border">
                  <td className="px-3 py-2">
                    {row.id ? (
                      <input
                        type="checkbox"
                        checked={selectedCards.includes(row.id)}
                        onChange={() => toggleCard(row.id!)}
                        aria-label={`Select ${row.studentName}`}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(row.studentId)}
                        onChange={() => toggleStudent(row.studentId)}
                        aria-label={`Select ${row.studentName}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{row.studentName}</td>
                  <td className="px-3 py-2">{row.rollNumber || '—'}</td>
                  <td className="px-3 py-2">{row.programme || '—'}</td>
                  <td className="px-3 py-2">{row.department || '—'}</td>
                  <td className="px-3 py-2">{row.semesterLabel}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        row.status === 'CLEARED' && 'bg-emerald-50 text-emerald-700',
                        row.status === 'PENDING' && 'bg-amber-50 text-amber-800',
                        row.status === 'NOT_PROCESSED' && 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.cardNumber || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openRow(row, 'view')}
                      >
                        View
                      </Button>
                      {canWrite ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openRow(row, 'edit')}
                        >
                          Edit
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!row.id}
                        onClick={() => row.id && void printCards([row.id])}
                      >
                        Print
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!row.id}
                        onClick={() => row.id && void downloadCards([row.id])}
                      >
                        PDF
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-muted-foreground">
                  {status === 'NOT_PROCESSED' && !contextReady
                    ? 'Choose the academic year, examination and semester to list students who have not been processed.'
                    : 'No clearance records match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} record{total === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {student?.studentName || detail.data?.studentName || 'Clearance card'}
            </DialogTitle>
            <DialogDescription>
              {dialog?.cardId
                ? `Card ${detail.data?.cardNumber || ''}`.trim()
                : 'Review the library account, then save the clearance record.'}
            </DialogDescription>
          </DialogHeader>

          {preview.isError ? (
            <QueryErrorPanel title="Unable to load the student" error={preview.error} />
          ) : null}
          {preview.data?.existing && dialog && !dialog.cardId ? (
            <div className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              A card already exists for this examination ({preview.data.existing.cardNumber}).
              <Button
                type="button"
                size="sm"
                variant="link"
                onClick={() => openStudent(dialog.studentId, preview.data!.existing!.id, 'view')}
              >
                Open it
              </Button>
            </div>
          ) : null}

          {student ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label="Roll no." value={student.rollNumber} />
              <Field label="NEHU Roll No." value={student.registrationNumber} />
              <Field label="Programme" value={student.programme} />
              <Field label="Department" value={student.department} />
              <Field
                label="Current semester"
                value={ROMAN[student.currentSemester] || String(student.currentSemester)}
              />
              <Field label="Academic session" value={student.academicSession} />
              <Field label="Mobile" value={student.mobileNumber} />
            </dl>
          ) : null}

          {library ? (
            <div className="mt-4 rounded-md border border-border p-3 text-sm">
              <p className="font-medium">Library records</p>
              <p className="mt-1 text-muted-foreground">
                {library.activeLoans} borrowed book{library.activeLoans === 1 ? '' : 's'} out · dues
                ₹{library.outstandingDues.toFixed(2)} · {library.openIncidents} open lost/damaged
                case
                {library.openIncidents === 1 ? '' : 's'}
                {library.membershipBlocked ? ' · account blocked' : ''}
              </p>
              {canWrite && dialog?.mode === 'edit' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    if (dialog) {
                      seededForm.current = `${dialog.studentId}:${dialog.cardId}:${dialog.mode}`;
                    }
                    setForm((current) => ({
                      ...current,
                      status: library.status,
                      booksReturned: library.booksReturned,
                      duesStatus: library.duesStatus,
                      lostDamagedStatus: library.lostDamagedStatus,
                      accountStatus: library.accountStatus,
                      remarks: library.suggestedRemarks ?? current.remarks,
                    }));
                  }}
                >
                  Use these library records
                </Button>
              ) : null}
            </div>
          ) : null}

          {dialog?.mode === 'edit' && canWrite ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Filter label="Academic year">
                <input
                  className={control}
                  value={dialog.academicYear}
                  disabled={Boolean(dialog.cardId)}
                  onChange={(event) => setDialog({ ...dialog, academicYear: event.target.value })}
                />
              </Filter>
              <Filter label="Examination name">
                <input
                  className={control}
                  value={dialog.examinationName}
                  disabled={Boolean(dialog.cardId)}
                  onChange={(event) =>
                    setDialog({ ...dialog, examinationName: event.target.value })
                  }
                />
              </Filter>
              <Filter label="Semester">
                <select
                  className={control}
                  value={dialog.semester}
                  disabled={Boolean(dialog.cardId)}
                  onChange={(event) => setDialog({ ...dialog, semester: event.target.value })}
                >
                  <option value="">Select</option>
                  {(options.data?.semesters ?? [1, 2, 3, 4, 5, 6, 7, 8]).map((item) => (
                    <option key={item} value={item}>
                      {ROMAN[item] || item}
                    </option>
                  ))}
                </select>
              </Filter>
              <Filter label="Clearance status">
                <select
                  className={control}
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as FormState['status'] })
                  }
                >
                  <option value="PENDING">Pending</option>
                  <option value="CLEARED">Cleared</option>
                </select>
              </Filter>
              <Filter label="All borrowed books returned">
                <select
                  className={control}
                  value={form.booksReturned}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      booksReturned: event.target.value as FormState['booksReturned'],
                    })
                  }
                >
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              </Filter>
              <Filter label="Outstanding library dues">
                <select
                  className={control}
                  value={form.duesStatus}
                  onChange={(event) =>
                    setForm({ ...form, duesStatus: event.target.value as FormState['duesStatus'] })
                  }
                >
                  <option value="CLEARED">Cleared</option>
                  <option value="PENDING">Pending</option>
                </select>
              </Filter>
              <Filter label="Lost or damaged books">
                <select
                  className={control}
                  value={form.lostDamagedStatus}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      lostDamagedStatus: event.target.value as FormState['lostDamagedStatus'],
                    })
                  }
                >
                  <option value="CLEARED">Cleared</option>
                  <option value="PENDING">Pending</option>
                </select>
              </Filter>
              <Filter label="Library account status">
                <select
                  className={control}
                  value={form.accountStatus}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      accountStatus: event.target.value as FormState['accountStatus'],
                    })
                  }
                >
                  <option value="CLEARED">Cleared</option>
                  <option value="NOT_CLEARED">Not cleared</option>
                </select>
              </Filter>
              <Filter label="Librarian's name">
                <input
                  className={control}
                  value={form.librarianName}
                  onChange={(event) => setForm({ ...form, librarianName: event.target.value })}
                />
              </Filter>
              <Filter label="Date of clearance">
                <input
                  className={control}
                  type="date"
                  value={form.clearedOn}
                  onChange={(event) => setForm({ ...form, clearedOn: event.target.value })}
                />
              </Filter>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Remarks
                </span>
                <textarea
                  className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  value={form.remarks}
                  onChange={(event) => setForm({ ...form, remarks: event.target.value })}
                />
              </label>
            </div>
          ) : detail.data ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                {detail.data.examinationName} · {detail.data.academicYear} · Semester{' '}
                {detail.data.semesterLabel}
              </p>
              <p>Books returned: {detail.data.booksReturned === 'YES' ? 'Yes' : 'No'}</p>
              <p>Dues: {detail.data.duesStatus === 'CLEARED' ? 'Cleared' : 'Pending'}</p>
              <p>
                Lost or damaged books:{' '}
                {detail.data.lostDamagedStatus === 'CLEARED' ? 'Cleared' : 'Pending'}
              </p>
              <p>Account: {detail.data.accountStatus === 'CLEARED' ? 'Cleared' : 'Not cleared'}</p>
              <p>Librarian: {detail.data.librarianName || '—'}</p>
              <p>Cleared on: {detail.data.clearedOn || '—'}</p>
              {detail.data.remarks ? <p>Remarks: {detail.data.remarks}</p> : null}
            </div>
          ) : null}

          {history.data?.cards.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium">Clearance history</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {history.data.cards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => card.id && openStudent(card.studentId, card.id, 'view')}
                    >
                      {card.cardNumber} · {card.examinationName} · Sem {card.semesterLabel} ·{' '}
                      {statusLabel(card.status)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.data?.events.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium">Status changes</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {detail.data.events.map((event) => (
                  <li key={event.id}>
                    {new Date(event.createdAt).toLocaleString('en-IN')} · {event.action} ·{' '}
                    {event.actorName}
                    {event.note ? ` · ${event.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter>
            {dialog?.cardId ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void printCards([dialog.cardId!])}
                >
                  Print
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadCards([dialog.cardId!])}
                >
                  Download PDF
                </Button>
              </>
            ) : null}
            {canWrite && dialog?.cardId ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={recheck.isPending}
                  onClick={() => recheck.mutate(dialog.cardId!)}
                >
                  Recheck
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={regenerate.isPending}
                  onClick={() => regenerate.mutate(dialog.cardId!)}
                >
                  Refresh student
                </Button>
              </>
            ) : null}
            {canWrite && dialog?.mode === 'view' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog({ ...dialog, mode: 'edit' })}
              >
                Edit
              </Button>
            ) : null}
            {canWrite && dialog?.mode === 'edit' ? (
              <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? 'Saving…' : dialog.cardId ? 'Save changes' : 'Generate card'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value == null ? '—' : value}</p>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}
