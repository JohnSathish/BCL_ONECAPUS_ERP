'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, Loader2, Plus, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  actOnIaApproval,
  createIaPaper,
  createIaScheme,
  createIaSession,
  downloadIaNehuExport,
  fetchFacultyIaSubjects,
  fetchIaAdminDashboard,
  fetchIaConsolidationSheets,
  fetchIaDefaulters,
  fetchIaPapers,
  fetchIaRoster,
  fetchIaSchemes,
  fetchIaSessions,
  fetchIaSettings,
  fetchPendingIaApprovals,
  generateIaConsolidation,
  importIaMarks,
  saveIaMarks,
  submitIaSheet,
  updateIaSettings,
  type IaComponent,
} from '@/services/examinations-ia';
import { cn } from '@/utils/cn';

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

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Total Students" value={summary.totalStudents ?? 0} />
      <Kpi label="IA Sessions" value={summary.iaSessions ?? 0} />
      <Kpi label="Scheduled Papers" value={summary.scheduledPapers ?? 0} />
      <Kpi label="Pending Mark Entry" value={summary.pendingMarkEntry ?? 0} />
      <Kpi label="Mark Entries" value={summary.markEntries ?? 0} />
      <Kpi label="Consolidation Sheets" value={summary.consolidationSheets ?? 0} />
      <Kpi label="Appeared" value={summary.studentsAppeared ?? 0} />
      <Kpi label="Absent" value={summary.studentsAbsent ?? 0} />
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
        status: 'DRAFT',
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
  const sessions = useQuery({ queryKey: ['ia', 'sessions'], queryFn: () => fetchIaSessions() });
  const papers = useQuery({ queryKey: ['ia', 'papers'], queryFn: () => fetchIaPapers() });
  const [sessionId, setSessionId] = useState('');
  const activeSession = sessionId || sessions.data?.[0]?.id || '';

  const create = useMutation({
    mutationFn: () =>
      createIaPaper({
        sessionId: activeSession,
        paperCode: 'SOC101',
        paperName: 'Introduction to Sociology',
        examDate: new Date().toISOString().slice(0, 10),
        startTime: new Date('1970-01-01T10:00:00Z').toISOString(),
        endTime: new Date('1970-01-01T12:00:00Z').toISOString(),
        semesterNo: 3,
        status: 'SCHEDULED',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ia', 'papers'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={activeSession}
          onChange={(e) => setSessionId(e.target.value)}
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {(sessions.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={() => create.mutate()}
          disabled={!activeSession || create.isPending}
        >
          <Plus className="h-4 w-4" /> Add Paper Row
        </Button>
      </div>
      <Card title="IA Timetable">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2">Code</th>
              <th className="py-2">Paper</th>
              <th className="py-2">Date</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(papers.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border/40">
                <td className="py-2">{p.paperCode}</td>
                <td className="py-2">{p.paperName}</td>
                <td className="py-2">{String(p.examDate).slice(0, 10)}</td>
                <td className="py-2">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const schemes = useQuery({ queryKey: ['ia', 'schemes'], queryFn: () => fetchIaSchemes() });
  const [paperId, setPaperId] = useState('');
  const [schemeId, setSchemeId] = useState('');

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
  const activeScheme = schemeId || schemes.data?.[0]?.id || '';

  const roster = useQuery({
    queryKey: ['ia', 'roster', activePaper, activeScheme],
    queryFn: () => fetchIaRoster(activePaper, activeScheme),
    enabled: Boolean(activePaper && activeScheme),
  });

  const [draft, setDraft] = useState<Record<string, number | null>>({});

  const save = useMutation({
    mutationFn: () => {
      const rows = Object.entries(draft).map(([key, marks]) => {
        const [studentId, componentId] = key.split(':');
        return { studentId, componentId, marks };
      });
      return saveIaMarks(activePaper, { schemeId: activeScheme, rows });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia', 'roster', activePaper, activeScheme] });
      setDraft({});
    },
  });

  const onImportCsv = async (file: File) => {
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
    await importIaMarks(activePaper, { schemeId: activeScheme, rows });
    qc.invalidateQueries({ queryKey: ['ia', 'roster', activePaper, activeScheme] });
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
        <select
          value={activeScheme}
          onChange={(e) => setSchemeId(e.target.value)}
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {(schemes.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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
          disabled={save.isPending || !Object.keys(draft).length}
        >
          <Save className="h-4 w-4" /> Save Marks
        </Button>
      </div>
      <Card title="Component Mark Grid">
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
    <Card title="Examination Settings">
      <div className="space-y-4 text-sm">
        <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
          <div>
            <p className="font-medium">Legacy University Exam Mode</p>
            <p className="text-xs text-muted-foreground">
              Show end-semester room allocation, invigilators, and result publish (hidden by default
              for DBC).
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
