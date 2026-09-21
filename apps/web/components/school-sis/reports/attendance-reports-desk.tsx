'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Download,
  Eye,
  FileBarChart2,
  FileSpreadsheet,
  Printer,
  Search,
  UserRound,
  Users,
  UserX,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { fetchSchoolSisMasters } from '@/services/school-sis';
import {
  downloadSchoolReport,
  fetchSchoolReportCatalog,
  fetchSchoolReportPreview,
  kindToSchoolReportExport,
  type SchoolReportExportKind,
} from '@/services/school-reports';
import './attendance-reports-desk.css';

type ReportItem = {
  key: string;
  title: string;
  description: string;
  filters?: string[];
};

function monthBounds(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(last).padStart(2, '0')}`,
  };
}

function kpiNum(kpis: Array<{ key?: string; label: string; value: string | number }>, key: string) {
  const hit = kpis.find((k) => k.key === key);
  return Number(hit?.value ?? 0);
}

function statusClass(value: string) {
  const v = value.toLowerCase();
  if (v.includes('excellent')) return 'is-excellent';
  if (v.includes('good')) return 'is-good';
  if (v.includes('normal')) return 'is-normal';
  return 'is-warning';
}

function iconFor(key: string) {
  if (key.includes('absentee')) return { Icon: UserX, tone: 'is-rose' };
  if (key.includes('subject')) return { Icon: BookOpen, tone: '' };
  if (key.includes('teacher') || key.includes('staff') || key.includes('student')) {
    return { Icon: UserRound, tone: '' };
  }
  if (key.includes('class') || key.includes('section')) return { Icon: Users, tone: 'is-violet' };
  if (key.includes('register')) return { Icon: ClipboardList, tone: 'is-amber' };
  if (key.includes('monthly') || key.includes('range') || key.includes('trend')) {
    return { Icon: CalendarDays, tone: '' };
  }
  return { Icon: FileBarChart2, tone: '' };
}

export function AttendanceReportsDesk({ showBreadcrumb = true }: { showBreadcrumb?: boolean }) {
  const ready = useAuthQueryEnabled();
  const bounds = monthBounds();
  const catalog = useQuery({
    queryKey: ['school-report-cat'],
    queryFn: fetchSchoolReportCatalog,
    enabled: ready,
  });
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled: ready,
  });
  const [key, setKey] = useState('attendance_daily');
  const [academicYearId, setAcademicYearId] = useState('');
  const [dateFrom, setDateFrom] = useState(bounds.from);
  const [dateTo, setDateTo] = useState(bounds.to);
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [applied, setApplied] = useState({
    academicYearId: '',
    dateFrom: bounds.from,
    dateTo: bounds.to,
    gradeId: '',
    sectionId: '',
    subjectId: '',
    studentId: '',
  });
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reports = useMemo(
    () => (catalog.data?.reports ?? []).filter((r) => r.module === 'attendance') as ReportItem[],
    [catalog.data],
  );
  const selected = reports.find((r) => r.key === key) ?? reports[0];

  useEffect(() => {
    if (!reports.length) return;
    if (!reports.some((r) => r.key === key)) setKey(reports[0].key);
  }, [reports, key]);

  useEffect(() => {
    const current = masters.data?.academicYear.id;
    if (current && !academicYearId) setAcademicYearId(current);
  }, [masters.data, academicYearId]);

  const filters: Record<string, string> = {
    ...(applied.academicYearId ? { academicYearId: applied.academicYearId } : {}),
    dateFrom: applied.dateFrom,
    dateTo: applied.dateTo,
    ...(applied.gradeId ? { gradeId: applied.gradeId } : {}),
    ...(applied.sectionId ? { sectionId: applied.sectionId } : {}),
    ...(applied.subjectId ? { subjectId: applied.subjectId } : {}),
    ...(applied.studentId ? { studentId: applied.studentId } : {}),
    ...(key.includes('monthly') ? { month: applied.dateFrom.slice(0, 7) } : {}),
  };

  const preview = useQuery({
    queryKey: ['school-att-report', key, filters],
    queryFn: () => fetchSchoolReportPreview(key, filters),
    enabled: ready && !!key,
  });

  const sections = (masters.data?.sections ?? []).filter((s) => !gradeId || s.grade.id === gradeId);
  const years = masters.data?.academicYears?.length
    ? masters.data.academicYears
    : masters.data?.academicYear
      ? [masters.data.academicYear]
      : [];

  const kpis = preview.data?.kpis ?? [];
  const summary = preview.data?.summary;
  const studentsCount = Number(summary?.students ?? kpiNum(kpis, 'students'));
  const present = Number(summary?.present ?? kpiNum(kpis, 'present'));
  const absent = Number(summary?.absent ?? kpiNum(kpis, 'absent'));
  const late = Number(summary?.late ?? kpiNum(kpis, 'late'));
  const leave = Number(summary?.leave ?? kpiNum(kpis, 'leave'));
  const presentPct = Number(summary?.presentPct ?? kpiNum(kpis, 'presentPct'));
  const absentPct = Number(summary?.absentPct ?? kpiNum(kpis, 'absentPct'));
  const latePct = Number(summary?.latePct ?? kpiNum(kpis, 'latePct'));
  const leavePct = Number(summary?.leavePct ?? kpiNum(kpis, 'leavePct'));

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = preview.data?.rows ?? [];
    if (!needle) return all;
    return all.filter((row) =>
      ['admissionNumber', 'fullName', 'className', 'sectionName', 'label', 'student'].some(
        (field) =>
          String(row[field] ?? '')
            .toLowerCase()
            .includes(needle),
      ),
    );
  }, [preview.data, q]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const columns = preview.data?.columns ?? [];

  useEffect(() => {
    setPage(1);
  }, [key, q, applied, pageSize]);

  async function runExport(kind: SchoolReportExportKind) {
    setBusy(kind);
    setExportOpen(false);
    try {
      const mapped = kindToSchoolReportExport(kind);
      await downloadSchoolReport({
        key,
        format: mapped.format,
        orientation: mapped.orientation,
        filters,
        summaryOnly: mapped.summaryOnly,
      });
    } finally {
      setBusy(null);
    }
  }

  const pageButtons = useMemo(() => {
    const last = pageCount;
    const set = new Set([1, last, safePage, safePage - 1, safePage + 1]);
    return [...set].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  }, [pageCount, safePage]);

  return (
    <div className="sls-att-reports">
      <div className="sls-att-reports-head">
        <div className="sls-att-reports-title">
          <span>
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            {showBreadcrumb ? (
              <p className="sls-att-reports-crumb">Reports / Attendance Reports</p>
            ) : null}
            <h1>Attendance Reports</h1>
            <p>View and analyse student attendance with detailed reports and charts.</p>
          </div>
        </div>
        <div className="sls-att-reports-actions">
          <button type="button" className="is-ghost" onClick={() => void runExport('print')}>
            <Printer className="h-4 w-4" />
            Print
          </button>
          <div className="relative">
            <button
              type="button"
              className="is-primary"
              onClick={() => setExportOpen((v) => !v)}
              disabled={!!busy}
            >
              <Download className="h-4 w-4" />
              {busy ? 'Exporting…' : 'Export'}
            </button>
            {exportOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border bg-white p-1 shadow-md">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => void runExport('pdf-portrait')}
                >
                  <FileBarChart2 className="h-4 w-4" /> PDF
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => void runExport('xlsx')}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {catalog.error ? (
        <p className="text-sm text-rose-700">{apiErrorMessage(catalog.error)}</p>
      ) : null}

      <div className="sls-att-kpis">
        <article className="sls-att-kpi is-sky">
          <i>
            <Users className="h-4 w-4" />
          </i>
          <div>
            <p>Total Students</p>
            <strong>{studentsCount || '—'}</strong>
            <em>In selected filters</em>
          </div>
        </article>
        <article className="sls-att-kpi is-emerald">
          <i>
            <ClipboardList className="h-4 w-4" />
          </i>
          <div>
            <p>Present</p>
            <strong>{present || '—'}</strong>
            <em>{presentPct ? `${presentPct}%` : '—'}</em>
          </div>
        </article>
        <article className="sls-att-kpi is-rose">
          <i>
            <UserX className="h-4 w-4" />
          </i>
          <div>
            <p>Absent</p>
            <strong>{absent || '—'}</strong>
            <em>{absentPct ? `${absentPct}%` : '—'}</em>
          </div>
        </article>
        <article className="sls-att-kpi is-amber">
          <i>
            <CalendarDays className="h-4 w-4" />
          </i>
          <div>
            <p>Late</p>
            <strong>{late || '—'}</strong>
            <em>{latePct ? `${latePct}%` : '—'}</em>
          </div>
        </article>
        <article className="sls-att-kpi is-violet">
          <i>
            <BookOpen className="h-4 w-4" />
          </i>
          <div>
            <p>Leave</p>
            <strong>{leave || '—'}</strong>
            <em>{leavePct ? `${leavePct}%` : '—'}</em>
          </div>
        </article>
      </div>

      <form
        className="sls-att-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({
            academicYearId,
            dateFrom,
            dateTo,
            gradeId,
            sectionId,
            subjectId,
            studentId: '',
          });
        }}
      >
        <label>
          Academic Year
          <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From Date
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label>
          To Date
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label>
          Class
          <select
            value={gradeId}
            onChange={(e) => {
              setGradeId(e.target.value);
              setSectionId('');
            }}
          >
            <option value="">All Classes</option>
            {(masters.data?.grades ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">All Subjects</option>
            {(masters.data?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="is-apply">
          Apply Filters
        </button>
        <button
          type="button"
          className="is-reset"
          onClick={() => {
            const next = monthBounds();
            const yearId = masters.data?.academicYear.id ?? '';
            setAcademicYearId(yearId);
            setDateFrom(next.from);
            setDateTo(next.to);
            setGradeId('');
            setSectionId('');
            setSubjectId('');
            setApplied({
              academicYearId: yearId,
              dateFrom: next.from,
              dateTo: next.to,
              gradeId: '',
              sectionId: '',
              subjectId: '',
              studentId: '',
            });
          }}
        >
          Reset
        </button>
      </form>

      <div className="sls-att-body">
        <aside className="sls-att-types">
          <h2>Attendance Reports</h2>
          {reports.map((report) => {
            const { Icon, tone } = iconFor(report.key);
            return (
              <button
                key={report.key}
                type="button"
                className={`sls-att-type ${tone} ${key === report.key ? 'is-active' : ''}`}
                onClick={() => setKey(report.key)}
              >
                <i>
                  <Icon className="h-3.5 w-3.5" />
                </i>
                <div>
                  <strong>{report.title}</strong>
                  <span>{report.description}</span>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="sls-att-panel">
          <div className="sls-att-panel-head">
            <div>
              <h2>{selected?.title ? `${selected.title} Report` : 'Attendance Report'}</h2>
              <p>{selected?.description || 'Student attendance for the selected date range.'}</p>
            </div>
            <div className="sls-att-toggle">
              <button
                type="button"
                className={view === 'chart' ? 'is-on' : ''}
                onClick={() => setView('chart')}
              >
                Chart View
              </button>
              <button
                type="button"
                className={view === 'table' ? 'is-on' : ''}
                onClick={() => setView('table')}
              >
                Table View
              </button>
            </div>
          </div>

          {view === 'chart' ? (
            <>
              <div className="sls-att-legend">
                <span>
                  <b style={{ background: '#22c55e' }} /> Present
                </span>
                <span>
                  <b style={{ background: '#ef4444' }} /> Absent
                </span>
                <span>
                  <b style={{ background: '#f59e0b' }} /> Late
                </span>
                <span>
                  <b style={{ background: '#8b5cf6' }} /> Leave
                </span>
              </div>
              <div className="sls-att-chart">
                {preview.isFetching ? (
                  <p className="sls-att-loading">Loading chart…</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={preview.data?.series ?? []} barGap={2} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="present" name="Present" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="leave" name="Leave" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          ) : null}

          <div className="sls-att-table-head">
            <h3>Student Attendance List</h3>
            <label className="sls-att-search">
              <Search className="h-4 w-4" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or admission no…"
              />
            </label>
            <div className="sls-att-counts">
              <span className="is-present">Present ({present})</span>
              <span className="is-absent">Absent ({absent})</span>
              <span className="is-late">Late ({late})</span>
              <span className="is-leave">Leave ({leave})</span>
            </div>
          </div>

          {preview.isFetching ? (
            <p className="sls-att-loading">Loading preview…</p>
          ) : preview.data?.empty && !rows.length ? (
            <p className="sls-att-empty">No records found for the selected filters.</p>
          ) : (
            <div className="sls-att-table-wrap">
              <table className="sls-att-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {columns.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, i) => (
                    <tr key={String(row.studentId ?? `${safePage}-${i}`)}>
                      <td>{(safePage - 1) * pageSize + i + 1}</td>
                      {columns.map((col) => {
                        const value = String(row[col.key] ?? '—');
                        if (col.key === 'status') {
                          return (
                            <td key={col.key}>
                              <span className={`sls-att-status ${statusClass(value)}`}>
                                {value}
                              </span>
                            </td>
                          );
                        }
                        if (col.key === 'percent') {
                          return <td key={col.key}>{value === '—' ? value : `${value}%`}</td>;
                        }
                        return <td key={col.key}>{value}</td>;
                      })}
                      <td>
                        <button
                          type="button"
                          className="sls-att-eye"
                          aria-label="View student attendance"
                          onClick={() => {
                            if (row.studentId) {
                              setKey('attendance_student');
                              setApplied((prev) => ({ ...prev, studentId: String(row.studentId) }));
                            }
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="sls-att-foot">
            <p>
              Showing {rows.length ? (safePage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(safePage * pageSize, rows.length)} of{' '}
              {rows.length || preview.data?.total || 0} students
            </p>
            <div className="sls-att-pages">
              {pageButtons.map((n, idx) => {
                const prev = pageButtons[idx - 1];
                return (
                  <span key={n} className="contents">
                    {prev && n - prev > 1 ? <span>…</span> : null}
                    <button
                      type="button"
                      className={n === safePage ? 'is-on' : ''}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[8, 16, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
