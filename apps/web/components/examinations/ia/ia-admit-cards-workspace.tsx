'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  Ticket,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  bulkGenerateIaAdmitCards,
  downloadIaAdmitPdf,
  downloadIaAdmitZip,
  fetchIaAdmitCard,
  fetchIaAdmitDashboard,
  fetchIaAdmitSessions,
  fetchIaAdmitStudents,
} from '@/services/examinations-ia';
import { IaAdmitCardPrint, type IaAdmitCardData } from './ia-admit-card-print';

type StudentRow = {
  id: string;
  rollNumber?: string | null;
  fullName?: string | null;
  programme?: string | null;
  programmeCode?: string | null;
  department?: string | null;
  departmentId?: string | null;
  paperCount: number;
  eligible: boolean;
  blocked: boolean;
  status: string;
  ineligibilityReasons: string[];
  missingFields: string[];
  admitCardNumber?: string | null;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function IaAdmitCardsWorkspace() {
  const printRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewCard, setPreviewCard] = useState<IaAdmitCardData | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [printCards, setPrintCards] = useState<IaAdmitCardData[]>([]);
  const [showIneligible, setShowIneligible] = useState(false);

  const sessions = useQuery({ queryKey: ['ia', 'admit-sessions'], queryFn: fetchIaAdmitSessions });
  const activeSession = sessionId || sessions.data?.[0]?.id || '';

  const dashboard = useQuery({
    queryKey: ['ia', 'admit-dashboard', activeSession, programmeFilter, departmentFilter],
    queryFn: () =>
      fetchIaAdmitDashboard(activeSession, {
        programmeCode: programmeFilter || undefined,
        departmentId: departmentFilter || undefined,
      }),
    enabled: Boolean(activeSession),
  });

  const roster = useQuery({
    queryKey: ['ia', 'admit-students', activeSession, programmeFilter, departmentFilter],
    queryFn: () =>
      fetchIaAdmitStudents(activeSession, {
        programmeCode: programmeFilter || undefined,
        departmentId: departmentFilter || undefined,
      }),
    enabled: Boolean(activeSession),
  });

  const students: StudentRow[] = roster.data?.students ?? [];
  const eligible = useMemo(() => students.filter((s) => s.eligible), [students]);
  const ineligible = useMemo(() => students.filter((s) => !s.eligible), [students]);
  const isDemo = roster.data?.session?.isDemo ?? dashboard.data?.isDemo;

  const programmes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      if (s.programmeCode) map.set(s.programmeCode, s.programme ?? s.programmeCode);
    }
    return Array.from(map.entries());
  }, [students]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      if (s.departmentId && s.department) map.set(s.departmentId, s.department);
    }
    return Array.from(map.entries());
  }, [students]);

  const preview = useMutation({
    mutationFn: (studentId: string) =>
      fetchIaAdmitCard(activeSession, studentId, { preview: true }),
    onSuccess: (data, studentId) => {
      setPreviewStudentId(studentId);
      setPreviewCard(data as IaAdmitCardData);
    },
  });

  const generateSelected = useMutation({
    mutationFn: (ids: string[]) => bulkGenerateIaAdmitCards(activeSession, ids),
    onSuccess: (data) => {
      const cards = (data.cards ?? []).filter((c: IaAdmitCardData) => !c.blocked);
      if (cards.length) setPreviewCard(cards[0]);
      roster.refetch();
      dashboard.refetch();
    },
  });

  const triggerPrint = (cards: IaAdmitCardData[]) => {
    setPrintCards(cards);
    document.body.classList.add('ia-admit-printing');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('ia-admit-printing');
    }, 200);
  };

  const bulkPrint = useMutation({
    mutationFn: (ids: string[]) => bulkGenerateIaAdmitCards(activeSession, ids),
    onSuccess: (data) => {
      const cards = (data.cards ?? []).filter((c: IaAdmitCardData) => !c.blocked);
      triggerPrint(cards);
    },
  });

  const pdfDownload = useMutation({
    mutationFn: (ids: string[]) => downloadIaAdmitPdf(activeSession, ids),
    onSuccess: (blob, ids) => {
      downloadBlob(blob, ids.length === 1 ? 'ia-admit-card.pdf' : 'ia-admit-cards-batch.pdf');
    },
  });

  const zipDownload = useMutation({
    mutationFn: (ids: string[]) => downloadIaAdmitZip(activeSession, ids),
    onSuccess: (blob) => downloadBlob(blob, 'ia-admit-cards.zip'),
  });

  const toggleAll = () => {
    const pool = showIneligible ? students : eligible;
    if (selected.size === pool.length) setSelected(new Set());
    else setSelected(new Set(pool.map((s) => s.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedEligibleIds = () =>
    Array.from(selected).filter((id) => eligible.some((s) => s.id === id));

  const kpis = dashboard.data?.kpis;

  const displayStudents = showIneligible ? ineligible : students;

  return (
    <div className="space-y-4 print:space-y-0">
      {isDemo ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 print:hidden">
          <strong>Demo Data Loaded.</strong> {kpis?.totalRegistered ?? students.length} demo
          students registered for {roster.data?.session?.name ?? 'IA Demo Session'} with scheduled
          papers. Preview the full admit card design before real examination data is available.
        </div>
      ) : null}

      {kpis ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <KpiCard label="Total Registered" value={kpis.totalRegistered} />
          <KpiCard label="Eligible" value={kpis.eligible} tone="success" />
          <KpiCard label="Not Eligible" value={kpis.ineligible} tone="danger" />
          <KpiCard label="Cards Generated" value={kpis.admitCardsGenerated} />
          <KpiCard label="Downloaded" value={kpis.admitCardsDownloaded} />
          <KpiCard label="Pending Verification" value={kpis.pendingEligibilityVerification} />
          <KpiCard
            label="Last Generated"
            value={
              kpis.lastGeneratedDate
                ? new Date(kpis.lastGeneratedDate).toLocaleDateString('en-IN')
                : '—'
            }
          />
          <KpiCard label="Fee Defaulters" value={dashboard.data?.feeDefaulters ?? 0} tone="warn" />
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 print:block">
        <section className="rounded-2xl border border-border/60 bg-card p-4 print:hidden">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Ticket className="h-4 w-4 text-primary" />
                IA Admit Card Generation
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Select session, filter students, preview and bulk-generate internal assessment admit
                cards.
              </p>
            </div>
            <select
              value={activeSession}
              onChange={(e) => {
                setSessionId(e.target.value);
                setSelected(new Set());
                setPreviewCard(null);
              }}
              className="h-9 min-w-[220px] rounded-xl border border-border bg-background px-3 text-sm"
            >
              {(sessions.data ?? []).map((s: { id: string; name: string; semesterNo?: number }) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.semesterNo ? ` · Sem ${s.semesterNo}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={programmeFilter}
              onChange={(e) => setProgrammeFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="">All Programmes</option>
              {programmes.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="">All Departments</option>
              {departments.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant={showIneligible ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setShowIneligible((v) => !v)}
            >
              {showIneligible ? 'Show All' : `Ineligible (${ineligible.length})`}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedEligibleIds().length || bulkPrint.isPending}
              onClick={() => bulkPrint.mutate(selectedEligibleIds())}
            >
              {bulkPrint.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Printer className="mr-1 h-3 w-3" />
              )}
              Print Selected ({selectedEligibleIds().length})
            </Button>
            <Button
              size="sm"
              disabled={!eligible.length || bulkPrint.isPending}
              onClick={() => bulkPrint.mutate(eligible.map((s) => s.id))}
            >
              <Printer className="mr-1 h-3 w-3" />
              Print All Eligible ({eligible.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedEligibleIds().length || pdfDownload.isPending}
              onClick={() => pdfDownload.mutate(selectedEligibleIds())}
            >
              <Download className="mr-1 h-3 w-3" />
              PDF Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!eligible.length || pdfDownload.isPending}
              onClick={() => pdfDownload.mutate(eligible.map((s) => s.id))}
            >
              <FileText className="mr-1 h-3 w-3" />
              PDF All
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedEligibleIds().length || zipDownload.isPending}
              onClick={() => zipDownload.mutate(selectedEligibleIds())}
            >
              <Archive className="mr-1 h-3 w-3" />
              ZIP Export
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!selectedEligibleIds().length || generateSelected.isPending}
              onClick={() => generateSelected.mutate(selectedEligibleIds())}
            >
              Generate Selected
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" />
                Students ({displayStudents.length})
              </h3>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={displayStudents.length > 0 && selected.size === displayStudents.length}
                  onChange={toggleAll}
                />
                Select all
              </label>
            </div>

            {roster.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading roster…</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="w-8 py-2 pr-2" />
                    <th className="py-2 pr-3">Roll</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Programme</th>
                    <th className="py-2 pr-3">Papers</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStudents.map((s) => (
                    <tr key={s.id} className="border-b border-border/40">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          disabled={!s.eligible && !showIneligible}
                          checked={selected.has(s.id)}
                          onChange={() => toggleOne(s.id)}
                          className="h-4 w-4"
                          aria-label={`Select ${s.fullName ?? s.rollNumber}`}
                        />
                      </td>
                      <td className="py-2 pr-3">{s.rollNumber ?? '—'}</td>
                      <td className="py-2 pr-3">{s.fullName ?? '—'}</td>
                      <td className="py-2 pr-3">{s.programme ?? '—'}</td>
                      <td className="py-2 pr-3">{s.paperCount}</td>
                      <td className="py-2 pr-3">
                        {!s.eligible ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                            title={s.ineligibilityReasons.join('; ')}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Ineligible
                          </span>
                        ) : s.admitCardNumber ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                            Generated
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                            Eligible
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={preview.isPending}
                          onClick={() => preview.mutate(s.id)}
                          aria-label="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!displayStudents.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No students in this view. Schedule papers and confirm registrations first.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-4 print:hidden lg:sticky lg:top-4 lg:self-start">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Admit Card Preview</h3>
            {previewCard && !previewCard.blocked ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => previewStudentId && pdfDownload.mutate([previewStudentId])}
                  disabled={pdfDownload.isPending || !previewStudentId}
                >
                  <Download className="mr-1 h-3 w-3" />
                  Download PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => triggerPrint([previewCard])}>
                  <Printer className="mr-1 h-3 w-3" />
                  Print
                </Button>
              </div>
            ) : null}
          </div>
          {preview.isPending ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading preview…
            </div>
          ) : previewCard ? (
            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              <IaAdmitCardPrint card={previewCard} />
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Select a student and click the eye icon to preview their admit card.
            </p>
          )}
        </section>
      </div>

      <div
        id="ia-admit-print-area"
        ref={printRef}
        className="pointer-events-none fixed -left-[9999px] top-0 w-full print:static print:left-0"
      >
        {printCards.map((card, i) => (
          <IaAdmitCardPrint key={card.admitCardNumber ?? i} card={card} />
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'success' | 'danger' | 'warn';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/50'
      : tone === 'danger'
        ? 'border-rose-200 bg-rose-50/50'
        : tone === 'warn'
          ? 'border-amber-200 bg-amber-50/50'
          : 'border-border/60 bg-card';
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
