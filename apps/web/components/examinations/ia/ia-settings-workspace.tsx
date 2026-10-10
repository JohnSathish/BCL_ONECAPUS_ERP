'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDays,
  Download,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import {
  actOnIaApproval,
  createIaScheme,
  downloadIaNehuExport,
  fetchIaConsolidationSheets,
  fetchIaSchemes,
  fetchIaSettings,
  fetchPendingIaApprovals,
  generateIaConsolidation,
  submitIaSheet,
  updateIaSchemeComponents,
  updateIaSettings,
  type IaComponent,
  type IaSettings,
} from '@/services/examinations-ia';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const BASE = '/admin/academics/examinations';

type Tab = 'general' | 'schemes' | 'components' | 'university';

type DraftSettings = {
  iaPassMarkPercent: string;
  attendanceMinPercent: string;
  blockAdmitOnDefaulter: boolean;
  legacyUniversityExamMode: boolean;
};

const blankComponent = (index: number): IaComponent => ({
  code: `C${index + 1}`,
  label: '',
  maxMarks: 0,
  weightage: undefined,
  isMandatory: true,
  sortOrder: index + 1,
});

export function IaSettingsWorkspace() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('general');
  const [draft, setDraft] = useState<DraftSettings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [semester, setSemester] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [componentRows, setComponentRows] = useState<IaComponent[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSemester, setNewSemester] = useState(1);
  const [newTotal, setNewTotal] = useState(40);
  const [newPass, setNewPass] = useState(16);
  const [newComponents, setNewComponents] = useState<IaComponent[]>([
    { code: 'IA', label: 'Internal assessment', maxMarks: 40, sortOrder: 1 },
  ]);
  const [sheetName, setSheetName] = useState('NEHU IA Submission');
  const [sheetSemester, setSheetSemester] = useState(1);
  const [downloading, setDownloading] = useState<string | null>(null);

  const settings = useQuery({ queryKey: ['ia', 'settings'], queryFn: fetchIaSettings });
  const schemes = useQuery({ queryKey: ['ia', 'schemes'], queryFn: () => fetchIaSchemes() });
  const sheets = useQuery({
    queryKey: ['ia', 'consolidation'],
    queryFn: fetchIaConsolidationSheets,
    enabled: tab === 'university',
  });
  const approvals = useQuery({
    queryKey: ['ia', 'approvals'],
    queryFn: fetchPendingIaApprovals,
    enabled: tab === 'university',
  });

  useEffect(() => {
    if (!settings.data || draft) return;
    setDraft(toDraft(settings.data));
  }, [settings.data, draft]);

  const selected =
    (schemes.data ?? []).find((scheme) => scheme.id === selectedId) ?? schemes.data?.[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    if (selectedId && selectedId !== selected.id) return;
    setSelectedId(selected.id);
    setComponentRows(
      (selected.components ?? []).map((component, index) => ({
        ...component,
        sortOrder: index + 1,
      })),
    );
  }, [selected, selectedId]);

  const saveSettings = useMutation({
    mutationFn: () =>
      updateIaSettings({
        iaPassMarkPercent: Number(draft?.iaPassMarkPercent),
        attendanceMinPercent: Number(draft?.attendanceMinPercent),
        blockAdmitOnDefaulter: draft?.blockAdmitOnDefaulter,
        legacyUniversityExamMode: draft?.legacyUniversityExamMode,
      }),
    onSuccess: (data: IaSettings) => {
      qc.setQueryData(['ia', 'settings'], data);
      setDraft(toDraft(data));
      setNotice('Examination settings saved.');
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'Settings could not be saved.')),
  });

  const createScheme = useMutation({
    mutationFn: () =>
      createIaScheme({
        name: newName.trim(),
        semesterNo: newSemester,
        totalMaxMarks: newTotal,
        passMark: newPass,
        components: newComponents.map((component, index) => ({
          ...component,
          sortOrder: index + 1,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia', 'schemes'] });
      setCreating(false);
      setNewName('');
      setNotice('Assessment scheme created.');
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'The scheme could not be created.')),
  });

  const saveComponents = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Choose a scheme.');
      return updateIaSchemeComponents(
        selected.id,
        componentRows.map((component, index) => ({ ...component, sortOrder: index + 1 })),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ia', 'schemes'] });
      setNotice('Components saved.');
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'Components could not be saved.')),
  });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (schemes.data ?? []).filter((scheme) => {
      if (semester !== 'all' && scheme.semesterNo !== Number(semester)) return false;
      if (status === 'locked' && !scheme.isLocked) return false;
      if (status === 'active' && (scheme.isLocked || scheme.status !== 'ACTIVE')) return false;
      if (status === 'other' && (scheme.status === 'ACTIVE' || scheme.isLocked)) return false;
      if (query && !scheme.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [schemes.data, search, semester, status]);

  const semesters = [
    ...new Set(
      (schemes.data ?? [])
        .map((scheme) => scheme.semesterNo)
        .filter((value): value is number => value != null),
    ),
  ].sort((a, b) => a - b);
  const activeSchemes = (schemes.data ?? []).filter(
    (scheme) => scheme.status === 'ACTIVE' && !scheme.isLocked,
  ).length;
  const componentTotal = componentRows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0);
  const weightTotal = componentRows.reduce((sum, row) => sum + Number(row.weightage || 0), 0);
  const newTotalMarks = newComponents.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0);
  const marksMatch = (left: number, right: number) => Math.abs(left - right) <= 0.01;

  if (settings.isError) {
    return (
      <QueryErrorPanel
        title="Unable to load examination settings"
        error={settings.error}
        onRetry={() => void settings.refetch()}
        isRetrying={settings.isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        <TabButton
          active={tab === 'general'}
          onClick={() => setTab('general')}
          icon={<Settings className="h-4 w-4" />}
        >
          General Settings
        </TabButton>
        <TabButton
          active={tab === 'schemes'}
          onClick={() => setTab('schemes')}
          icon={<BookOpen className="h-4 w-4" />}
        >
          Assessment Schemes
        </TabButton>
        <TabButton
          active={tab === 'components'}
          onClick={() => setTab('components')}
          icon={<Shield className="h-4 w-4" />}
        >
          Components & Weightage
        </TabButton>
        <TabButton
          active={tab === 'university'}
          onClick={() => setTab('university')}
          icon={<Upload className="h-4 w-4" />}
        >
          University Files
        </TabButton>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={<BookOpen className="h-5 w-5" />}
          tone="blue"
          label="Active Schemes"
          value={String(activeSchemes)}
          hint="Unlocked and active"
        />
        <Stat
          icon={<Settings className="h-5 w-5" />}
          tone="green"
          label="Schemes on Record"
          value={String((schemes.data ?? []).length)}
          hint="Including locked schemes"
        />
        <Stat
          icon={<Shield className="h-5 w-5" />}
          tone="violet"
          label="IA Pass Mark"
          value={`${Number(settings.data?.iaPassMarkPercent ?? 0)}%`}
          hint="Used for pass rate and defaulters"
        />
        <Stat
          icon={<CalendarDays className="h-5 w-5" />}
          tone="amber"
          label="Attendance Minimum"
          value={`${Number(settings.data?.attendanceMinPercent ?? 0)}%`}
          hint="Used for admit cards and defaulters"
        />
      </section>

      {tab === 'general' && !draft ? (
        <p className="text-sm text-slate-500">Loading examination settings…</p>
      ) : null}

      {tab === 'general' && draft ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">General Examination Settings</h2>
          <p className="mb-4 text-xs text-slate-500">
            These values apply to internal assessment for this college.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-slate-500">
              IA pass mark (%)
              <input
                type="number"
                min={0}
                max={100}
                value={draft.iaPassMarkPercent}
                onChange={(event) => setDraft({ ...draft, iaPassMarkPercent: event.target.value })}
                className={inputClass}
              />
              <span className="mt-1 block">
                A student meets the IA pass rule at or above this percent.
              </span>
            </label>
            <label className="text-xs text-slate-500">
              Attendance minimum (%)
              <input
                type="number"
                min={0}
                max={100}
                value={draft.attendanceMinPercent}
                onChange={(event) =>
                  setDraft({ ...draft, attendanceMinPercent: event.target.value })
                }
                className={inputClass}
              />
              <span className="mt-1 block">
                Students below this attendance are listed as attendance defaulters.
              </span>
            </label>
            <Toggle
              label="Block admit card for defaulters"
              hint="When on, a listed defaulter cannot be issued an internal assessment admit card."
              checked={draft.blockAdmitOnDefaulter}
              onChange={(checked) => setDraft({ ...draft, blockAdmitOnDefaulter: checked })}
            />
            <Toggle
              label="Legacy university examination mode"
              hint="Shows the older end-semester examination tools. Internal assessment stays the default."
              checked={draft.legacyUniversityExamMode}
              onChange={(checked) => setDraft({ ...draft, legacyUniversityExamMode: checked })}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saveSettings.isPending}
              onClick={() => saveSettings.mutate()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> Save settings
            </button>
            <Link href={`${BASE}/nehu-submission`} className="text-xs font-medium text-blue-600">
              University submission files
            </Link>
          </div>
        </section>
      ) : null}

      {tab === 'schemes' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Assessment Schemes</h2>
              <p className="text-xs text-slate-500">
                Schemes already configured for internal assessment.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreating((value) => !value)}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Create Scheme
            </button>
          </div>
          {creating ? (
            <div className="mb-4 rounded-xl border border-slate-100 p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="text-xs text-slate-500 md:col-span-2">
                  Scheme name
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Semester
                  <select
                    value={newSemester}
                    onChange={(event) => setNewSemester(Number(event.target.value))}
                    className={inputClass}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                      <option key={value} value={value}>
                        Semester {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  Total marks
                  <input
                    type="number"
                    min={1}
                    value={newTotal}
                    onChange={(event) => setNewTotal(Number(event.target.value))}
                    className={inputClass}
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Pass mark
                  <input
                    type="number"
                    min={0}
                    value={newPass}
                    onChange={(event) => setNewPass(Number(event.target.value))}
                    className={inputClass}
                  />
                </label>
              </div>
              <ComponentEditor rows={newComponents} onChange={setNewComponents} />
              <p className="mt-2 text-xs text-slate-500">
                Component marks {newTotalMarks} / scheme total {newTotal}
              </p>
              <button
                type="button"
                disabled={
                  !newName.trim() || !marksMatch(newTotalMarks, newTotal) || createScheme.isPending
                }
                onClick={() => createScheme.mutate()}
                className="mt-3 inline-flex h-9 items-center rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                Save scheme
              </button>
            </div>
          ) : null}
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search scheme by name…"
              className="h-9 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <select
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="all">All semesters</option>
              {semesters.map((value) => (
                <option key={value} value={value}>
                  Semester {value}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-3">Scheme</th>
                  <th className="py-2 pr-3">Semester</th>
                  <th className="py-2 pr-3">Total marks</th>
                  <th className="py-2 pr-3">Components</th>
                  <th className="py-2 pr-3">Pass mark</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((scheme, index) => (
                  <tr key={scheme.id} className="border-t border-slate-100">
                    <td className="py-2 pr-2 text-slate-400">{index + 1}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{scheme.name}</td>
                    <td className="py-2 pr-3">{scheme.semesterNo ?? '—'}</td>
                    <td className="py-2 pr-3">{Number(scheme.totalMaxMarks)}</td>
                    <td className="py-2 pr-3">{scheme.components?.length ?? 0}</td>
                    <td className="py-2 pr-3">
                      {scheme.passMark != null ? Number(scheme.passMark) : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          scheme.isLocked
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {scheme.isLocked ? 'Locked' : scheme.status}
                      </span>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-600"
                        onClick={() => {
                          setSelectedId(scheme.id);
                          setTab('components');
                        }}
                      >
                        Components
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length ? (
              <p className="py-6 text-sm text-slate-500">No schemes match these filters.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === 'components' && !selected ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          No assessment schemes yet. Create one from the Assessment Schemes tab.
        </p>
      ) : null}

      {tab === 'components' && selected ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Components & Weightage</h2>
              <p className="text-xs text-slate-500">
                {selected.name}. Component marks must equal {Number(selected.totalMaxMarks)}.
                {selected.isLocked ? ' This scheme is locked because mark entry has started.' : ''}
              </p>
            </div>
            <select
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="h-9 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {(schemes.data ?? []).map((scheme) => (
                <option key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </option>
              ))}
            </select>
          </div>
          <ComponentEditor
            rows={componentRows}
            onChange={setComponentRows}
            disabled={selected.isLocked}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <p>
              Marks {componentTotal} / {Number(selected.totalMaxMarks)}
              {weightTotal ? ` · Weightage ${weightTotal}%` : ''}
            </p>
            <button
              type="button"
              disabled={
                selected.isLocked ||
                !marksMatch(componentTotal, Number(selected.totalMaxMarks)) ||
                saveComponents.isPending
              }
              onClick={() => saveComponents.mutate()}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Save components
            </button>
          </div>
        </section>
      ) : null}

      {tab === 'university' ? (
        <UniversityFiles
          sheets={(sheets.data ?? []) as SheetRow[]}
          approvals={(approvals.data ?? []) as ApprovalRow[]}
          sheetName={sheetName}
          semesterNo={sheetSemester}
          downloading={downloading}
          onName={setSheetName}
          onSemester={setSheetSemester}
          onGenerate={() =>
            generateIaConsolidation({ name: sheetName.trim(), semesterNo: sheetSemester })
              .then(() => {
                qc.invalidateQueries({ queryKey: ['ia', 'consolidation'] });
                setNotice('Consolidation sheet generated.');
              })
              .catch((error) =>
                setNotice(
                  apiErrorMessage(error, 'The consolidation sheet could not be generated.'),
                ),
              )
          }
          onSubmit={(id) =>
            submitIaSheet(id).then(() => {
              qc.invalidateQueries({ queryKey: ['ia', 'consolidation'] });
              qc.invalidateQueries({ queryKey: ['ia', 'approvals'] });
            })
          }
          onApproval={(id, action) =>
            actOnIaApproval(id, { action }).then(() => {
              qc.invalidateQueries({ queryKey: ['ia', 'consolidation'] });
              qc.invalidateQueries({ queryKey: ['ia', 'approvals'] });
            })
          }
          onDownload={async (id, format) => {
            setDownloading(`${id}-${format}`);
            try {
              const blob = await downloadIaNehuExport(id, format);
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `nehu-ia-${id}.${format === 'pdf' ? 'html' : format}`;
              link.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              setNotice(apiErrorMessage(error, 'The university file could not be downloaded.'));
            } finally {
              setDownloading(null);
            }
          }}
        />
      ) : null}

      {notice ? <p className="text-sm text-slate-600">{notice}</p> : null}
    </div>
  );
}

type SheetRow = { id: string; name: string; status: string; rows?: unknown[] };
type ApprovalRow = { id: string; step: string; status: string; sheet?: { name: string } };

function UniversityFiles({
  sheets,
  approvals,
  sheetName,
  semesterNo,
  downloading,
  onName,
  onSemester,
  onGenerate,
  onSubmit,
  onApproval,
  onDownload,
}: {
  sheets: SheetRow[];
  approvals: ApprovalRow[];
  sheetName: string;
  semesterNo: number;
  downloading: string | null;
  onName: (value: string) => void;
  onSemester: (value: number) => void;
  onGenerate: () => void;
  onSubmit: (id: string) => void;
  onApproval: (id: string, action: 'APPROVE' | 'REJECT') => void;
  onDownload: (id: string, format: 'xlsx' | 'csv' | 'pdf') => void;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">NEHU consolidation</h2>
        <p className="mb-3 text-xs text-slate-500">
          Generate a sheet from entered internal assessment marks, then download it for university
          submission.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={sheetName}
            onChange={(event) => onName(event.target.value)}
            className="h-10 min-w-[240px] rounded-xl border border-slate-200 px-3 text-sm"
          />
          <select
            value={semesterNo}
            onChange={(event) => onSemester(Number(event.target.value))}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
              <option key={value} value={value}>
                Semester {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!sheetName.trim()}
            onClick={onGenerate}
            className="h-10 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Sheets</h2>
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-slate-800">{sheet.name}</p>
              <p className="text-xs text-slate-500">
                {sheet.status} · {sheet.rows?.length ?? 0} rows
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sheet.status === 'DRAFT' ? (
                <button
                  type="button"
                  onClick={() => onSubmit(sheet.id)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  Submit
                </button>
              ) : null}
              {(['xlsx', 'csv', 'pdf'] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  disabled={downloading === `${sheet.id}-${format}`}
                  onClick={() => onDownload(sheet.id, format)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  <Download className="h-3 w-3" /> {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!sheets.length ? (
          <p className="text-sm text-slate-500">No consolidation sheet yet.</p>
        ) : null}
      </div>
      {approvals.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Pending approvals</h2>
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-800">{approval.sheet?.name ?? 'Sheet'}</p>
                <p className="text-xs text-slate-500">{approval.step}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onApproval(approval.id, 'APPROVE')}
                  className="rounded-lg bg-blue-600 px-2 py-1 text-xs text-white"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onApproval(approval.id, 'REJECT')}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const inputClass =
  'mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none';

function toDraft(settings: IaSettings): DraftSettings {
  return {
    iaPassMarkPercent: String(Number(settings.iaPassMarkPercent ?? 40)),
    attendanceMinPercent: String(Number(settings.attendanceMinPercent ?? 75)),
    blockAdmitOnDefaulter: Boolean(settings.blockAdmitOnDefaulter),
    legacyUniversityExamMode: Boolean(settings.legacyUniversityExamMode),
  };
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold',
        active ? 'bg-blue-600 text-white' : 'bg-white text-slate-600',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Stat({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  tone: 'blue' | 'green' | 'violet' | 'amber';
  label: string;
  value: string;
  hint: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <article className={cn('rounded-2xl border border-white p-3 shadow-sm', tones[tone])}>
      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-white/80 p-2">{icon}</span>
        <div>
          <p className="text-[11px] text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{hint}</p>
    </article>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm">
      <span>
        <span className="block font-medium text-slate-800">{label}</span>
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4"
      />
    </label>
  );
}

function ComponentEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: IaComponent[];
  onChange: (rows: IaComponent[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<IaComponent>) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };
  return (
    <div className="mt-3 space-y-2 overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-[90px_1fr_90px_90px_36px] gap-2 text-[11px] uppercase tracking-wide text-slate-400">
        <span>Code</span>
        <span>Component</span>
        <span>Marks</span>
        <span>Weight %</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div
          key={`${row.code}-${index}`}
          className="grid min-w-[640px] grid-cols-[90px_1fr_90px_90px_36px] gap-2"
        >
          <input
            disabled={disabled}
            value={row.code}
            onChange={(event) => update(index, { code: event.target.value })}
            placeholder="Code"
            className={inputClass}
          />
          <input
            disabled={disabled}
            value={row.label}
            onChange={(event) => update(index, { label: event.target.value })}
            placeholder="Component name"
            className={inputClass}
          />
          <input
            disabled={disabled}
            type="number"
            min={0}
            value={row.maxMarks}
            onChange={(event) => update(index, { maxMarks: Number(event.target.value) })}
            className={inputClass}
          />
          <input
            disabled={disabled}
            type="number"
            min={0}
            value={row.weightage ?? ''}
            onChange={(event) =>
              update(index, {
                weightage: event.target.value === '' ? undefined : Number(event.target.value),
              })
            }
            placeholder="Weight %"
            className={inputClass}
          />
          <button
            type="button"
            disabled={disabled || rows.length === 1}
            onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            className="mt-1 text-rose-500 disabled:opacity-30"
            aria-label="Remove component"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {!disabled ? (
        <button
          type="button"
          onClick={() => onChange([...rows, blankComponent(rows.length)])}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"
        >
          <Plus className="h-3.5 w-3.5" /> Add component
        </button>
      ) : null}
    </div>
  );
}
