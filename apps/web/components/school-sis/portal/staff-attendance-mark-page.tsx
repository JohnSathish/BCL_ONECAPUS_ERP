'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Info,
  LayoutGrid,
  List,
  MessageSquare,
  MoreHorizontal,
  Search,
  UserCheck,
  UserMinus,
  UserX,
  Users,
} from 'lucide-react';
import {
  fetchSchoolPortalRoster,
  fetchSchoolTeacherToday,
  submitSchoolPortalAttendance,
} from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { asList, asRecord, asText } from './portal-utils';
import { usePortalData } from './portal-data';

const STATUS = [
  { code: 'PRESENT', letter: 'P', tone: 'present' },
  { code: 'ABSENT', letter: 'A', tone: 'absent' },
  { code: 'LATE', letter: 'L', tone: 'late' },
  { code: 'HALF_DAY', letter: 'H', tone: 'half' },
  { code: 'LEAVE', letter: 'LV', tone: 'leave' },
] as const;

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function splitLabel(label: string) {
  const t = label.trim();
  const m = t.match(/^(.*)\s+([A-Z0-9]+)$/i);
  if (m) return { grade: m[1].trim(), section: m[2].trim() };
  return { grade: t, section: '' };
}

type SectionOpt = { id: string; label: string; grade: string; section: string };

type StudentRow = {
  id: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: string;
  recordId: string;
  status: string;
  remark: string;
};

export function StaffAttendanceMarkPage() {
  const authed = useAuthQueryEnabled();
  const { home } = usePortalData();
  const [date, setDate] = useState(isoToday);
  const [grade, setGrade] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ['teacher-today', date],
    queryFn: () => fetchSchoolTeacherToday(date),
    enabled: authed,
  });

  const sections = useMemo(() => {
    const periodRows = asList(asRecord(tasks.data).periods).map(asRecord);
    const classRows = asList(asRecord(tasks.data).classes).map(asRecord);
    const desk = asList(asRecord(home?.desk).classes).map(asRecord);
    const seen = new Set<string>();
    const out: SectionOpt[] = [];
    for (const row of [...classRows, ...periodRows, ...desk]) {
      const id = asText(row.sectionId ?? row.id, '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const label = asText(row.label ?? row.name ?? row.classLabel, 'Class');
      out.push({ id, label, ...splitLabel(label) });
    }
    return out;
  }, [tasks.data, home?.desk]);

  const grades = useMemo(
    () => [...new Set(sections.map((s) => s.grade).filter(Boolean))],
    [sections],
  );
  const sectionNames = useMemo(
    () => [
      ...new Set(
        sections
          .filter((s) => !grade || s.grade === grade)
          .map((s) => s.section)
          .filter(Boolean),
      ),
    ],
    [sections, grade],
  );

  useEffect(() => {
    if (!sections.length) return;
    const match =
      sections.find((s) => s.grade === grade && (!sectionName || s.section === sectionName)) ||
      sections[0];
    if (match.grade && match.grade !== grade) setGrade(match.grade);
    if (match.section && match.section !== sectionName) setSectionName(match.section);
    if (match.id !== sectionId) setSectionId(match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, grade, sectionName]);

  const roster = useQuery({
    queryKey: ['portal-roster', date, sectionId],
    queryFn: () => fetchSchoolPortalRoster({ date, sectionId }),
    enabled: authed && Boolean(sectionId),
  });

  const students = useMemo<StudentRow[]>(() => {
    return asList(asRecord(roster.data).students ?? asRecord(roster.data).rows).map((row) => {
      const item = asRecord(row);
      return {
        id: asText(item.studentId ?? item.id),
        fullName: asText(item.fullName ?? asRecord(item.student).fullName),
        admissionNumber: asText(item.admissionNumber, ''),
        rollNumber: asText(item.rollNumber, ''),
        recordId: asText(item.recordId, ''),
        status: asText(item.status, ''),
        remark: asText(item.remark, ''),
      };
    });
  }, [roster.data]);

  useEffect(() => {
    const nextMarks: Record<string, string> = {};
    const nextRemarks: Record<string, string> = {};
    for (const row of students) {
      if (row.recordId && row.status) nextMarks[row.id] = row.status;
      if (row.remark) nextRemarks[row.id] = row.remark;
    }
    setMarks(nextMarks);
    setRemarks(nextRemarks);
    setSelected({});
    setPage(1);
  }, [students]);

  const academicYearId = asText(asRecord(asRecord(roster.data).academicYear).id, '');
  const filtered = students.filter((row) => {
    const hay = `${row.fullName} ${row.admissionNumber} ${row.rollNumber}`.toLowerCase();
    if (!hay.includes(query.trim().toLowerCase())) return false;
    if (statusFilter === 'unmarked') return !marks[row.id];
    if (statusFilter !== 'all') return marks[row.id] === statusFilter;
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const counts = {
    present: students.filter((s) => marks[s.id] === 'PRESENT').length,
    absent: students.filter((s) => marks[s.id] === 'ABSENT').length,
    late: students.filter((s) => marks[s.id] === 'LATE').length,
    unmarked: students.filter((s) => !marks[s.id]).length,
  };
  const pct = (n: number) => (students.length ? Math.round((n / students.length) * 100) : 0);
  const selectedIds = students.filter((s) => selected[s.id]).map((s) => s.id);

  const setMany = (ids: string[], code: string) => {
    setMarks((cur) => {
      const next = { ...cur };
      for (const id of ids) next[id] = code;
      return next;
    });
  };

  const save = useMutation({
    mutationFn: () =>
      submitSchoolPortalAttendance({
        academicYearId,
        date,
        sectionId,
        records: students
          .filter((row) => marks[row.id])
          .map((row) => ({
            studentId: row.id,
            statusCode: marks[row.id],
            remark: remarks[row.id] || undefined,
          })),
      }),
    onError: (err) => {
      setOk(null);
      setError(apiErrorMessage(err));
    },
    onSuccess: () => {
      setError(null);
      setOk('Attendance saved. The mobile register is updated.');
      void roster.refetch();
    },
  });

  return (
    <div className="sls-att">
      <div className="sls-att-head">
        <div className="flex items-start gap-3">
          <span className="sls-att-title-ico">
            <UserCheck className="h-5 w-5" />
          </span>
          <div>
            <h1>Mark Student Attendance</h1>
            <p>Select the date and class, then mark attendance for all students.</p>
          </div>
        </div>
        <div className="sls-att-crumb">
          <Link href="/school-sis-portal/staff">Classroom</Link>
          <span>/</span>
          Mark Attendance
        </div>
      </div>

      <div className="sls-att-toolbar portal-card">
        <label className="sls-att-field">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || date)} />
        </label>
        <select
          value={grade}
          onChange={(e) => {
            setGrade(e.target.value);
            setSectionName('');
          }}
        >
          <option value="">Class</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={sectionName} onChange={(e) => setSectionName(e.target.value)}>
          <option value="">Section</option>
          {sectionNames.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="sls-att-note">
          <Info className="h-4 w-4" />
          Same live register used by the mobile app. Changes made here will be reflected in the
          mobile app immediately.
        </p>
        <div className="sls-att-actions">
          <button
            type="button"
            className="sls-att-ghost"
            disabled
            title="Import from the office attendance desk"
          >
            <Download className="h-3.5 w-3.5" /> Import
          </button>
          <button
            type="button"
            className="sls-att-ghost is-present"
            onClick={() =>
              setMany(
                students.map((s) => s.id),
                'PRESENT',
              )
            }
          >
            Set All Present
          </button>
          <button
            type="button"
            className="sls-att-ghost is-absent"
            onClick={() =>
              setMany(
                students.map((s) => s.id),
                'ABSENT',
              )
            }
          >
            Set All Absent
          </button>
        </div>
      </div>

      <div className="sls-att-kpis">
        <Kpi label="Total Students" value={students.length} hint="" tone="navy" icon={Users} />
        <Kpi
          label="Present"
          value={counts.present}
          hint={`${pct(counts.present)}%`}
          tone="green"
          icon={UserCheck}
        />
        <Kpi
          label="Absent"
          value={counts.absent}
          hint={`${pct(counts.absent)}%`}
          tone="rose"
          icon={UserX}
        />
        <Kpi
          label="Late"
          value={counts.late}
          hint={`${pct(counts.late)}%`}
          tone="amber"
          icon={Clock}
        />
        <Kpi
          label="Not Marked"
          value={counts.unmarked}
          hint={`${pct(counts.unmarked)}%`}
          tone="violet"
          icon={UserMinus}
        />
      </div>

      <div className="sls-att-table-card portal-card">
        <div className="sls-att-table-tools">
          <label className="sls-att-search">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, admission no., roll no..."
            />
            <Filter className="h-4 w-4 text-slate-400" />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Show</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter students"
            >
              <option value="all">All Students</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="unmarked">Not Marked</option>
            </select>
            <div className="sls-att-view">
              <button
                type="button"
                className={cn(view === 'list' && 'is-on')}
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" /> List View
              </button>
              <button
                type="button"
                className={cn(view === 'grid' && 'is-on')}
                onClick={() => setView('grid')}
              >
                <LayoutGrid className="h-4 w-4" /> Grid View
              </button>
            </div>
          </div>
        </div>

        {view === 'list' ? (
          <div className="overflow-x-auto">
            <table className="sls-att-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every((r) => selected[r.id])}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setSelected((cur) => {
                          const next = { ...cur };
                          for (const row of pageRows) next[row.id] = on;
                          return next;
                        });
                      }}
                    />
                  </th>
                  <th>#</th>
                  <th>Student Name</th>
                  <th>Admission No.</th>
                  <th>Roll No.</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(selected[row.id])}
                        onChange={(e) =>
                          setSelected((cur) => ({ ...cur, [row.id]: e.target.checked }))
                        }
                      />
                    </td>
                    <td>{(page - 1) * pageSize + i + 1}</td>
                    <td className="font-semibold text-slate-800">{row.fullName}</td>
                    <td className="font-mono text-xs">{row.admissionNumber || '—'}</td>
                    <td className="font-mono">{row.rollNumber || '—'}</td>
                    <td>
                      <div className="sls-att-chips">
                        {STATUS.map((st) => (
                          <button
                            key={st.code}
                            type="button"
                            className={cn(
                              'sls-att-chip',
                              `is-${st.tone}`,
                              marks[row.id] === st.code && 'is-on',
                            )}
                            onClick={() =>
                              setMarks((cur) => ({
                                ...cur,
                                [row.id]: cur[row.id] === st.code ? '' : st.code,
                              }))
                            }
                          >
                            {st.letter}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <label className="sls-att-remark-wrap">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <input
                          className="sls-att-remark"
                          placeholder="Add remark..."
                          value={remarks[row.id] ?? ''}
                          onChange={(e) =>
                            setRemarks((cur) => ({ ...cur, [row.id]: e.target.value }))
                          }
                        />
                      </label>
                    </td>
                    <td>
                      <span className="sls-att-row-acts">
                        <MessageSquare className="h-4 w-4" />
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!pageRows.length ? (
              <p className="portal-empty">
                {sectionId
                  ? roster.isLoading
                    ? 'Loading roster…'
                    : 'No students match this class and filter.'
                  : 'Select a class to load the register.'}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="sls-att-grid">
            {pageRows.map((row) => (
              <article key={row.id} className="sls-att-card">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[row.id])}
                    onChange={(e) => setSelected((cur) => ({ ...cur, [row.id]: e.target.checked }))}
                  />
                  <span>
                    <strong>{row.fullName}</strong>
                    <em>
                      {row.admissionNumber} · Roll {row.rollNumber || '—'}
                    </em>
                  </span>
                </label>
                <div className="sls-att-chips mt-3">
                  {STATUS.map((st) => (
                    <button
                      key={st.code}
                      type="button"
                      className={cn(
                        'sls-att-chip',
                        `is-${st.tone}`,
                        marks[row.id] === st.code && 'is-on',
                      )}
                      onClick={() => setMarks((cur) => ({ ...cur, [row.id]: st.code }))}
                    >
                      {st.letter}
                    </button>
                  ))}
                </div>
              </article>
            ))}
            {!pageRows.length ? (
              <p className="portal-empty">
                {sectionId
                  ? 'No students match this class and filter.'
                  : 'Select a class to load the register.'}
              </p>
            ) : null}
          </div>
        )}

        <div className="sls-att-pager">
          <p>
            Showing {(page - 1) * pageSize + (filtered.length ? 1 : 0)} to{' '}
            {Math.min(page * pageSize, filtered.length)} of {filtered.length} students
          </p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: pages })
              .slice(0, 6)
              .map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={cn(page === i + 1 && 'is-on')}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="sls-att-foot portal-card">
        <p>
          <strong>{selectedIds.length}</strong> selected
        </p>
        <div className="sls-att-bulk">
          Bulk actions:
          <button type="button" onClick={() => setMany(selectedIds, 'PRESENT')}>
            Mark Present
          </button>
          <button type="button" onClick={() => setMany(selectedIds, 'ABSENT')}>
            Mark Absent
          </button>
          <button type="button" onClick={() => setMany(selectedIds, 'LATE')}>
            Mark Late
          </button>
          <button type="button" onClick={() => setSelected({})}>
            Clear
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {ok ? <p className="text-sm text-emerald-600">{ok}</p> : null}
          <button
            type="button"
            className="sls-btn-primary"
            disabled={save.isPending || !sectionId || !academicYearId}
            onClick={() => save.mutate()}
          >
            <Check className="mr-1 inline h-4 w-4" />
            Save Attendance
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'navy' | 'green' | 'rose' | 'amber' | 'violet';
  icon: typeof Users;
}) {
  return (
    <div className={cn('sls-att-kpi', `is-${tone}`)}>
      <span className="sls-att-kpi-ico">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}
