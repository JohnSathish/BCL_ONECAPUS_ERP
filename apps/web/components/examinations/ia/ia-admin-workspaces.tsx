'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Printer,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import {
  actOnIaApproval,
  createIaPaper,
  createIaScheme,
  createIaSession,
  downloadIaNehuExport,
  downloadIaNoticeboardRoutinePdf,
  fetchFacultyIaSubjects,
  fetchIaAdminDashboard,
  fetchIaConsolidationSheets,
  fetchIaDefaulters,
  fetchIaExams,
  fetchIaNoticeboardRoutineHtml,
  fetchIaPapers,
  fetchIaRoster,
  fetchIaSchemes,
  fetchIaSessions,
  fetchIaSettings,
  fetchPendingIaApprovals,
  generateIaConsolidation,
  generateIaTimetable,
  importIaMarks,
  saveIaMarks,
  submitIaSheet,
  updateIaSettings,
  type IaComponent,
} from '@/services/examinations-ia';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function formatPaperClock(value: string | Date | null | undefined) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') {
    const match = value.match(/T(\d{2}):(\d{2})/) ?? value.match(/^(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  // Prisma TIME is stored on 1970-01-01; use UTC hours to avoid TZ skew.
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function formatPaperDate(value: string | Date | null | undefined) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function IaDashboardWorkspace() {
  const dashboard = useQuery({ queryKey: ['ia', 'dashboard'], queryFn: fetchIaAdminDashboard });
  const summary = dashboard.data?.summary ?? {};

  if (dashboard.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading IA dashboard…</p>;
  }

  if (dashboard.isError) {
    return (
      <QueryErrorPanel
        title="Unable to load IA dashboard"
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
        isRetrying={dashboard.isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total IA Exams" value={summary.iaSessions ?? 0} />
        <Kpi
          label="Registered Students"
          value={summary.registeredStudents ?? summary.totalStudents ?? 0}
        />
        <Kpi label="Eligible Students" value={summary.eligibleStudents ?? '—'} />
        <Kpi label="Defaulters" value={summary.defaulters ?? '—'} />
        <Kpi label="Subjects Scheduled" value={summary.scheduledPapers ?? 0} />
        <Kpi label="Admit Cards Generated" value={summary.admitCardsGenerated ?? 0} />
        <Kpi label="Marks Pending" value={summary.pendingMarkEntry ?? 0} />
        <Kpi label="Marks Completed" value={summary.marksCompleted ?? summary.markEntries ?? 0} />
      </div>
      {(dashboard.data?.workflow ?? []).length > 0 && (
        <Card title="Workflow Status">
          <ul className="space-y-1 text-sm">
            {dashboard.data.workflow.map((w: { status: string; count: number }) => (
              <li key={w.status} className="flex justify-between">
                <span>{w.status.replace(/_/g, ' ')}</span>
                <strong>{w.count}</strong>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const DEFAULT_COMPONENTS: IaComponent[] = [
  { code: 'IA_TEST_1', label: 'IA Test 1', maxMarks: 20 },
  { code: 'IA_TEST_2', label: 'IA Test 2', maxMarks: 10 },
  { code: 'ASSIGNMENT', label: 'Assignment', maxMarks: 5 },
  { code: 'ATTENDANCE', label: 'Attendance', maxMarks: 5 },
];

export function IaSchemesWorkspace() {
  const qc = useQueryClient();
  const schemes = useQuery({ queryKey: ['ia', 'schemes'], queryFn: () => fetchIaSchemes() });
  const [name, setName] = useState('');
  const [semesterNo, setSemesterNo] = useState(3);

  const create = useMutation({
    mutationFn: () =>
      createIaScheme({
        name: name || 'IA Scheme',
        semesterNo,
        totalMaxMarks: 40,
        components: DEFAULT_COMPONENTS,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia', 'schemes'] });
      setName('');
    },
  });

  return (
    <div className="space-y-4">
      <Card title="Create IA Assessment Scheme">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Scheme name (e.g. Sociology Sem 3)"
            className="h-9 min-w-[220px] rounded-xl border border-border bg-background px-3 text-sm"
          />
          <select
            value={semesterNo}
            onChange={(e) => setSemesterNo(Number(e.target.value))}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
          >
            {[1, 3, 5].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Scheme
          </Button>
        </div>
      </Card>
      <Card title="Assessment Schemes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Sem</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Components</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(schemes.data ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border/40">
                  <td className="py-2 pr-3 font-medium">{s.name}</td>
                  <td className="py-2 pr-3">{s.semesterNo ?? '—'}</td>
                  <td className="py-2 pr-3">{Number(s.totalMaxMarks)}</td>
                  <td className="py-2 pr-3">{s.components?.length ?? 0}</td>
                  <td className="py-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        s.isLocked
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800',
                      )}
                    >
                      {s.isLocked ? 'Locked' : s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!schemes.data?.length && (
            <p className="py-4 text-sm text-muted-foreground">No schemes yet. Create one above.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

export function IaSessionsWorkspace() {
  const qc = useQueryClient();
  const sessions = useQuery({ queryKey: ['ia', 'sessions'], queryFn: () => fetchIaSessions() });
  const [name, setName] = useState('IA Test 1 — Demo');
  const [examType, setExamType] = useState('IA_TEST_1');

  const create = useMutation({
    mutationFn: () =>
      createIaSession({
        name,
        examType,
        semesterNo: 3,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ia', 'sessions'] }),
  });

  return (
    <div className="space-y-4">
      <Card title="Create IA Exam Session">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 min-w-[240px] rounded-xl border border-border bg-background px-3 text-sm"
          />
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
          >
            {[
              'IA_TEST_1',
              'IA_TEST_2',
              'IA_TEST_3',
              'IA_PRACTICAL',
              'IA_VIVA',
              'IA_ASSIGNMENT',
            ].map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="h-4 w-4" /> Create Session
          </Button>
        </div>
      </Card>
      <Card title="IA Sessions">
        <ul className="divide-y text-sm">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.examType} · Sem {s.semesterNo ?? '—'}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{s.status}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function IaTimetableWorkspace() {
  const qc = useQueryClient();
  const exams = useQuery({ queryKey: ['ia', 'exams'], queryFn: fetchIaExams });
  const papers = useQuery({ queryKey: ['ia', 'papers'], queryFn: () => fetchIaPapers() });
  const [sessionId, setSessionId] = useState('');
  const [startDate, setStartDate] = useState('2026-08-24');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [mode, setMode] = useState<'SIMPLE' | 'FYUGP_FIRST_IA'>('FYUGP_FIRST_IA');
  const [routinePattern, setRoutinePattern] = useState<'MORNING' | 'DAY' | 'AUTO'>('AUTO');
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const activeSession = sessionId || exams.data?.[0]?.id || '';
  const selectedExam = (exams.data ?? []).find((s) => s.id === activeSession);
  const sessionPapers = (papers.data ?? []).filter((p) => p.sessionId === activeSession);

  const inferredPattern = useMemo(() => {
    const name = (
      selectedExam?.stats?.shiftName ??
      selectedExam?.metadata?.shiftName ??
      selectedExam?.name ??
      ''
    ).toLowerCase();
    if (name.includes('morning')) return 'MORNING' as const;
    if (name.includes('day')) return 'DAY' as const;
    return 'DAY' as const;
  }, [selectedExam]);

  const resolvedPattern = routinePattern === 'AUTO' ? inferredPattern : routinePattern;

  const generate = useMutation({
    mutationFn: () =>
      generateIaTimetable({
        sessionId: activeSession,
        startDate,
        mode,
        ...(mode === 'SIMPLE'
          ? { durationMinutes, defaultStartTime: '10:00' }
          : { routinePattern: resolvedPattern }),
      }),
    onSuccess: (result) => {
      const warn = result.warnings ?? [];
      setWarnings(warn);
      setMessage(
        mode === 'FYUGP_FIRST_IA'
          ? `FYUGP First IA timetable applied to ${result.updated} subjects (${resolvedPattern} pattern).`
          : `Timetable generated for ${result.updated} subjects.`,
      );
      qc.invalidateQueries({ queryKey: ['ia', 'papers'] });
      qc.invalidateQueries({ queryKey: ['ia', 'exams'] });
    },
    onError: () =>
      setMessage('Could not generate timetable. Ensure an IA exam exists with scheduled subjects.'),
  });

  const downloadPdf = useMutation({
    mutationFn: () =>
      downloadIaNoticeboardRoutinePdf(activeSession, {
        routinePattern: resolvedPattern,
        startDate,
      }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FYUGP-First-IA-${resolvedPattern}-Noticeboard.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Noticeboard routine PDF downloaded.');
    },
    onError: (e) =>
      setMessage(
        apiErrorMessage(
          e,
          'Could not download noticeboard PDF. Set Start date (e.g. 2026-08-24) and try again.',
        ),
      ),
  });

  const printHtml = useMutation({
    mutationFn: () =>
      fetchIaNoticeboardRoutineHtml(activeSession, {
        routinePattern: resolvedPattern,
        startDate,
      }),
    onSuccess: (html) => {
      const w = window.open('', '_blank');
      if (!w) {
        setMessage('Popup blocked — allow popups to print, or use Download PDF.');
        return;
      }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
      setMessage('Noticeboard opened for printing.');
    },
    onError: (e) =>
      setMessage(
        apiErrorMessage(
          e,
          'Could not open noticeboard. Set Start date (e.g. 2026-08-24) and try again.',
        ),
      ),
  });

  return (
    <div className="space-y-4">
      <Card title="Auto Scheduling Wizard">
        <p className="mb-3 text-xs text-muted-foreground">
          Prefer <strong>FYUGP First Internal Assessment routine</strong> for Morning/Day printed IA
          grids (MAJOR → VAC by day). Use Simple auto-pack only for ad-hoc packing by paper code.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">IA Exam</p>
            <select
              value={activeSession}
              onChange={(e) => setSessionId(e.target.value)}
              className="h-9 min-w-[220px] rounded-xl border border-border bg-background px-3 text-sm"
            >
              {(exams.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.stats?.shiftName || s.metadata?.shiftName
                    ? ` (${s.stats?.shiftName ?? s.metadata?.shiftName})`
                    : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Mode</p>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'SIMPLE' | 'FYUGP_FIRST_IA')}
              className="h-9 min-w-[240px] rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="FYUGP_FIRST_IA">FYUGP First Internal Assessment routine</option>
              <option value="SIMPLE">Simple auto-pack (legacy)</option>
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Start date</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
          {mode === 'FYUGP_FIRST_IA' ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Routine pattern</p>
              <select
                value={routinePattern}
                onChange={(e) => setRoutinePattern(e.target.value as 'MORNING' | 'DAY' | 'AUTO')}
                className="h-9 min-w-[180px] rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="AUTO">Auto from shift ({inferredPattern})</option>
                <option value="MORNING">Morning (7:15–8:00 + Sat VAC)</option>
                <option value="DAY">Day (9:45–10:40 + Fri VAC afternoon)</option>
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Duration (minutes)</p>
              <input
                type="number"
                min={30}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 120)}
                className="h-9 w-24 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
          )}
          <Button
            size="sm"
            onClick={() => generate.mutate()}
            disabled={!activeSession || generate.isPending}
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {mode === 'FYUGP_FIRST_IA' ? 'Apply FYUGP First IA Timetable' : 'Generate Timetable'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadPdf.mutate()}
            disabled={!activeSession || downloadPdf.isPending || !startDate}
          >
            {downloadPdf.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download noticeboard PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => printHtml.mutate()}
            disabled={!activeSession || printHtml.isPending || !startDate}
          >
            {printHtml.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Print noticeboard
          </Button>
        </div>
        {mode === 'FYUGP_FIRST_IA' ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Day 0 from start date = Monday MAJOR / MAJOR 1. Morning VAC falls on Saturday; Day Shift
            Sem 1 VAC is Friday afternoon (1:45–2:10). After applying, download the noticeboard PDF
            for the notice board (Morning and Day exams separately).
          </p>
        ) : null}
        {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
        {warnings.length ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
            {warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card title="IA Timetable — Table View">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 font-medium">Paper</th>
                <th className="py-2 pr-3 font-medium">Sem</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {sessionPapers.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-mono text-xs">{p.paperCode}</td>
                  <td className="py-2 pr-3">{p.paperName}</td>
                  <td className="py-2 pr-3">{p.semesterNo ?? '—'}</td>
                  <td className="py-2 pr-3">{formatPaperDate(p.examDate)}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {formatPaperClock(p.startTime)}–{formatPaperClock(p.endTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sessionPapers.length ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No papers for this exam yet. Create an IA examination first.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function IaMarkEntryWorkspace({ staffMode = false }: { staffMode?: boolean }) {
  const qc = useQueryClient();
  const subjects = useQuery({
    queryKey: ['ia', staffMode ? 'faculty-subjects' : 'papers'],
    queryFn: staffMode ? fetchFacultyIaSubjects : () => fetchIaPapers(),
  });
  const [paperId, setPaperId] = useState('');

  const paperOptions = useMemo((): Array<{ id: string; label: string }> => {
    if (staffMode) {
      return (subjects.data ?? []).flatMap(
        (s: {
          papers?: Array<{ id: string; paperCode: string; paperName: string }>;
          courseCode: string;
        }) =>
          (s.papers ?? []).map((p) => ({
            id: p.id,
            label: `${s.courseCode} — ${p.paperName || p.paperCode}`,
          })),
      );
    }
    return (subjects.data ?? []).map((p: { id: string; paperCode: string; paperName: string }) => ({
      id: p.id,
      label: `${p.paperCode} — ${p.paperName}`,
    }));
  }, [staffMode, subjects.data]);

  const activePaper = paperId || paperOptions[0]?.id || '';

  const roster = useQuery({
    queryKey: ['ia', 'roster', activePaper],
    queryFn: () => fetchIaRoster(activePaper),
    enabled: Boolean(activePaper),
  });

  const resolvedSchemeId = roster.data?.scheme?.id ?? '';

  const [draft, setDraft] = useState<Record<string, number | null>>({});

  const save = useMutation({
    mutationFn: () => {
      if (!resolvedSchemeId) throw new Error('No mark scheme linked to this subject');
      const rows = Object.entries(draft).map(([key, marks]) => {
        const [studentId, componentId] = key.split(':');
        return { studentId, componentId, marks };
      });
      return saveIaMarks(activePaper, { schemeId: resolvedSchemeId, rows });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia', 'roster', activePaper] });
      setDraft({});
    },
  });

  const onImportCsv = async (file: File) => {
    if (!resolvedSchemeId) return;
    const text = await file.text();
    const lines = text.trim().split('\n').slice(1);
    const rows = lines
      .map((line) => line.split(','))
      .filter((cols) => cols.length >= 3)
      .map(([rollNumber, componentCode, marks]) => ({
        rollNumber: rollNumber.trim(),
        componentCode: componentCode.trim(),
        marks: Number(marks),
      }));
    await importIaMarks(activePaper, { schemeId: resolvedSchemeId, rows });
    qc.invalidateQueries({ queryKey: ['ia', 'roster', activePaper] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={activePaper}
          onChange={(e) => setPaperId(e.target.value)}
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {paperOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {roster.data?.scheme ? (
          <span className="inline-flex items-center rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground">
            Max {Number(roster.data.scheme.totalMaxMarks)} marks ·{' '}
            {roster.data.scheme.components?.length ?? 0} component(s)
          </span>
        ) : null}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs">
          Import CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onImportCsv(e.target.files[0])}
          />
        </label>
        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending || !Object.keys(draft).length || !resolvedSchemeId}
        >
          <Save className="h-4 w-4" /> Save Marks
        </Button>
      </div>
      <Card title="Mark Entry">
        {roster.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading roster…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Roll</th>
                  <th className="py-2 pr-3">Name</th>
                  {(roster.data?.scheme?.components ?? []).map(
                    (c: IaComponent & { id: string }) => (
                      <th key={c.id} className="py-2 px-2 text-center">
                        {c.label}
                        <br />
                        <span className="text-[10px]">/{c.maxMarks}</span>
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {(roster.data?.students ?? []).map(
                  (s: {
                    id: string;
                    rollNumber?: string;
                    fullName?: string;
                    marks: Array<{ componentId: string; marks: number | null; maxMarks: number }>;
                  }) => (
                    <tr key={s.id} className="border-b border-border/40">
                      <td className="py-2 pr-3">{s.rollNumber}</td>
                      <td className="py-2 pr-3">{s.fullName}</td>
                      {s.marks.map((m) => {
                        const key = `${s.id}:${m.componentId}`;
                        const value = key in draft ? draft[key] : m.marks;
                        return (
                          <td key={m.componentId} className="px-1 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={m.maxMarks}
                              value={value ?? ''}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [key]: e.target.value === '' ? null : Number(e.target.value),
                                }))
                              }
                              className="h-8 w-16 rounded-lg border border-border bg-background text-center text-xs"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function IaConsolidationWorkspace() {
  const qc = useQueryClient();
  const sheets = useQuery({
    queryKey: ['ia', 'consolidation'],
    queryFn: fetchIaConsolidationSheets,
  });
  const pending = useQuery({ queryKey: ['ia', 'approvals'], queryFn: fetchPendingIaApprovals });
  const [name, setName] = useState('NEHU IA Submission — Sem 3');

  const generate = useMutation({
    mutationFn: () => generateIaConsolidation({ name, semesterNo: 3 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ia', 'consolidation'] }),
  });

  const submit = useMutation({
    mutationFn: (id: string) => submitIaSheet(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia', 'consolidation'] });
      qc.invalidateQueries({ queryKey: ['ia', 'approvals'] });
    },
  });

  const approve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      actOnIaApproval(id, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia', 'consolidation'] });
      qc.invalidateQueries({ queryKey: ['ia', 'approvals'] });
    },
  });

  return (
    <div className="space-y-4">
      <Card title="Generate Consolidation Sheet">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 min-w-[260px] rounded-xl border border-border bg-background px-3 text-sm"
          />
          <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
            Generate
          </Button>
        </div>
      </Card>
      <Card title="Consolidation Sheets">
        <ul className="divide-y text-sm">
          {(sheets.data ?? []).map(
            (s: { id: string; name: string; status: string; rows?: unknown[] }) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.status} · {s.rows?.length ?? 0} rows
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.status === 'DRAFT' && (
                    <Button size="sm" variant="outline" onClick={() => submit.mutate(s.id)}>
                      <Send className="h-3 w-3" /> Submit
                    </Button>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      </Card>
      {(pending.data ?? []).length > 0 && (
        <Card title="Pending Approvals (HOD → Controller → Principal)">
          <ul className="divide-y text-sm">
            {(pending.data ?? []).map(
              (a: { id: string; step: string; status: string; sheet?: { name: string } }) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">{a.sheet?.name ?? 'Sheet'}</p>
                    <p className="text-xs text-muted-foreground">{a.step}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approve.mutate({ id: a.id, action: 'APPROVE' })}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => approve.mutate({ id: a.id, action: 'REJECT' })}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function IaNehuExportWorkspace() {
  const sheets = useQuery({
    queryKey: ['ia', 'consolidation'],
    queryFn: fetchIaConsolidationSheets,
  });
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (id: string, format: 'xlsx' | 'csv' | 'pdf') => {
    setDownloading(`${id}-${format}`);
    try {
      const blob = await downloadIaNehuExport(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nehu-ia-${id}.${format === 'pdf' ? 'html' : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card title="NEHU Submission Reports">
      <p className="mb-3 text-sm text-muted-foreground">
        Export consolidated IA marks for NEHU handoff — Excel (primary), CSV, or print-ready
        PDF/HTML.
      </p>
      <ul className="divide-y text-sm">
        {(sheets.data ?? []).map((s: { id: string; name: string; status: string }) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.status}</p>
            </div>
            <div className="flex gap-2">
              {(['xlsx', 'csv', 'pdf'] as const).map((fmt) => (
                <Button
                  key={fmt}
                  size="sm"
                  variant="outline"
                  disabled={downloading === `${s.id}-${fmt}`}
                  onClick={() => download(s.id, fmt)}
                >
                  {downloading === `${s.id}-${fmt}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  {fmt.toUpperCase()}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {!sheets.data?.length && (
        <p className="py-4 text-sm text-muted-foreground">
          Generate a consolidation sheet first, then export here.
        </p>
      )}
    </Card>
  );
}

export function IaDefaultersWorkspace() {
  const defaulters = useQuery({ queryKey: ['ia', 'defaulters'], queryFn: fetchIaDefaulters });

  return (
    <Card title="Defaulter Management">
      <p className="mb-3 text-sm text-muted-foreground">
        Students flagged for IA below pass threshold, attendance, fees, or library dues.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2">Roll</th>
            <th className="py-2">Name</th>
            <th className="py-2">IA %</th>
            <th className="py-2">Reasons</th>
          </tr>
        </thead>
        <tbody>
          {(defaulters.data?.items ?? []).map(
            (d: {
              studentId: string;
              rollNumber?: string;
              fullName?: string;
              iaPercent?: number | null;
              reasons: string[];
            }) => (
              <tr key={d.studentId} className="border-b border-border/40">
                <td className="py-2">{d.rollNumber}</td>
                <td className="py-2">{d.fullName}</td>
                <td className="py-2">{d.iaPercent != null ? d.iaPercent.toFixed(1) : '—'}</td>
                <td className="py-2">
                  <ul className="flex flex-wrap gap-1">
                    {d.reasons.map((r) => (
                      <li
                        key={r}
                        className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {!defaulters.data?.items?.length && (
        <p className="py-4 text-sm text-muted-foreground">No defaulters found.</p>
      )}
    </Card>
  );
}

export function IaSettingsWorkspace() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['ia', 'settings'], queryFn: fetchIaSettings });

  const update = useMutation({
    mutationFn: (
      payload: Partial<{ legacyUniversityExamMode: boolean; iaPassMarkPercent: number }>,
    ) => updateIaSettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ia', 'settings'] }),
  });

  if (settings.isLoading) return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  const cfg = settings.data;

  return (
    <div className="space-y-6">
      <Card title="Examination Settings">
        <div className="space-y-4 text-sm">
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
            <div>
              <p className="font-medium">Legacy University Exam Mode</p>
              <p className="text-xs text-muted-foreground">
                Show end-semester room allocation, invigilators, and result publish (hidden by
                default for DBC).
              </p>
            </div>
            <input
              type="checkbox"
              checked={cfg?.legacyUniversityExamMode ?? false}
              onChange={(e) => update.mutate({ legacyUniversityExamMode: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
            <div>
              <p className="font-medium">IA Pass Mark (%)</p>
            </div>
            <input
              type="number"
              min={0}
              max={100}
              defaultValue={cfg?.iaPassMarkPercent ?? 40}
              onBlur={(e) => update.mutate({ iaPassMarkPercent: Number(e.target.value) })}
              className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-center"
            />
          </label>
        </div>
      </Card>

      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-sm font-semibold">Advanced configuration</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Assessment schemes, weightages, and consolidation are managed here for power users only.
          Normal IA workflow uses auto-provisioned schemes when you create an IA exam.
        </p>
      </div>

      <IaSchemesWorkspace />
      <IaConsolidationWorkspace />
    </div>
  );
}

export function IaPlaceholderWorkspace({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card title={title}>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
