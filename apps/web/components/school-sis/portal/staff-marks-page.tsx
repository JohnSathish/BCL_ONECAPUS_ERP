'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Filter,
  Home,
  Info,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  fetchSchoolExamMarkHistory,
  fetchSchoolExamMarkOptions,
  fetchSchoolExamMarkRoster,
  saveSchoolPortalExamMarks,
} from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { asList, asNumber, asRecord, asText } from './portal-utils';

type MarkRow = {
  studentId: string;
  rollNumber: string;
  fullName: string;
  admissionNumber: string;
  marks: string;
  status: string;
  remarks: string;
  entryStatus: string;
};

type TabId = 'entry' | 'summary' | 'history';

function presentStatus(status: string) {
  return !status || status === 'PRESENT';
}

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsv(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const cols: string[] = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else if (ch === '"') quoted = false;
          else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') {
          cols.push(cur.trim());
          cur = '';
        } else cur += ch;
      }
      cols.push(cur.trim());
      return cols;
    })
    .filter((cols) => cols.some((c) => c));
}

export function StaffMarksPage() {
  const authed = useAuthQueryEnabled();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dirty = useRef(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [examId, setExamId] = useState('');
  const [gradeName, setGradeName] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [query, setQuery] = useState('');
  const [absentOnly, setAbsentOnly] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<TabId>('entry');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [guidelines, setGuidelines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [savingHint, setSavingHint] = useState('');

  const options = useQuery({
    queryKey: ['school-marks-options'],
    queryFn: fetchSchoolExamMarkOptions,
    enabled: authed,
  });

  const exams = asList(asRecord(options.data).exams).map(asRecord);
  const classes = asList(asRecord(options.data).classes).map(asRecord);
  const selectedClass = classes.find((c) => asText(c.name) === gradeName);
  const sections = asList(selectedClass?.sections).map(asRecord);
  const selectedExam = exams.find((e) => asText(e.id) === examId);
  const gradeId = asText(selectedClass?.gradeId, '');
  const subjects = useMemo(() => {
    return asList(selectedExam?.subjects)
      .map(asRecord)
      .filter((s) => !gradeId || asText(s.gradeId) === gradeId);
  }, [selectedExam, gradeId]);
  const selectedSubject = subjects.find((s) => asText(s.id) === subjectId);
  const components = asList(selectedSubject?.components).map(asRecord);
  const selectedComponent = components.find((c) => asText(c.id) === componentId);
  const maxMarks = asNumber(selectedComponent?.maxMarks, 0);
  const passMarks = asNumber(selectedComponent?.passMarks, 0);

  useEffect(() => {
    if (!examId && exams[0]) setExamId(asText(exams[0].id, ''));
  }, [exams, examId]);
  useEffect(() => {
    if (!gradeName && classes[0]) setGradeName(asText(classes[0].name, ''));
  }, [classes, gradeName]);
  useEffect(() => {
    if (!sections.length) {
      if (sectionId) setSectionId('');
      return;
    }
    if (!sections.some((s) => asText(s.id) === sectionId)) {
      setSectionId(asText(sections[0].id, ''));
    }
  }, [sections, sectionId]);
  useEffect(() => {
    if (!subjects.length) {
      if (subjectId) setSubjectId('');
      return;
    }
    if (!subjects.some((s) => asText(s.id) === subjectId)) {
      setSubjectId(asText(subjects[0].id, ''));
    }
  }, [subjects, subjectId]);
  useEffect(() => {
    if (!components.length) {
      if (componentId) setComponentId('');
      return;
    }
    if (!components.some((c) => asText(c.id) === componentId)) {
      setComponentId(asText(components[0].id, ''));
    }
  }, [components, componentId]);

  const rosterReady = Boolean(examId && sectionId && componentId);
  const roster = useQuery({
    queryKey: ['school-marks-roster', examId, sectionId, componentId],
    queryFn: () => fetchSchoolExamMarkRoster({ examId, sectionId, componentId }),
    enabled: authed && rosterReady,
  });
  const history = useQuery({
    queryKey: ['school-marks-history', examId, sectionId, componentId],
    queryFn: () => fetchSchoolExamMarkHistory({ examId, sectionId, componentId }),
    enabled: authed && rosterReady && tab === 'history',
  });

  useEffect(() => {
    const list = asList(asRecord(roster.data).rows).map((row) => {
      const item = asRecord(row);
      return {
        studentId: asText(item.studentId, ''),
        rollNumber: asText(item.rollNumber, ''),
        fullName: asText(item.fullName, ''),
        admissionNumber: asText(item.admissionNumber, ''),
        marks: item.marks == null || item.marks === '' ? '' : String(item.marks),
        status: asText(item.status, 'PRESENT') || 'PRESENT',
        remarks: asText(item.remarks, ''),
        entryStatus: asText(item.entryStatus, 'DRAFT'),
      } satisfies MarkRow;
    });
    dirty.current = false;
    setRows(list);
    setSelected({});
    setError(null);
  }, [roster.data]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const payloadRows = () =>
    rows.map((row) => ({
      studentId: row.studentId,
      marks: presentStatus(row.status) && row.marks !== '' ? Number(row.marks) : null,
      status: presentStatus(row.status) ? 'PRESENT' : 'ABSENT',
      remarks: row.remarks || undefined,
    }));

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      saveSchoolPortalExamMarks({
        examId,
        componentId,
        submit,
        rows: payloadRows(),
      }),
    onSuccess: (_data, submit) => {
      setError(null);
      dirty.current = false;
      if (submit) {
        setOk('Marks saved and confirmed for this class.');
        void qc.invalidateQueries({ queryKey: ['school-marks-roster'] });
        void qc.invalidateQueries({ queryKey: ['school-marks-history'] });
      } else {
        setSavingHint('Draft saved');
        window.setTimeout(() => setSavingHint(''), 1600);
      }
    },
    onError: (err) => {
      setOk(null);
      setError(apiErrorMessage(err));
    },
  });

  useEffect(() => {
    if (!dirty.current || !rosterReady || !rows.length) return;
    const invalid = rows.some((row) => {
      if (!presentStatus(row.status) || row.marks === '') return false;
      const n = Number(row.marks);
      return !Number.isFinite(n) || (maxMarks > 0 && n > maxMarks) || n < 0;
    });
    if (invalid) return;
    const t = window.setTimeout(() => save.mutate(false), 900);
    return () => window.clearTimeout(t);
    // save.mutate identity changes with mutation status; debounce only on row edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rosterReady, maxMarks]);

  function patchRow(id: string, patch: Partial<MarkRow>) {
    dirty.current = true;
    setOk(null);
    setRows((prev) => prev.map((row) => (row.studentId === id ? { ...row, ...patch } : row)));
  }

  function toggleStatus(id: string) {
    const row = rows.find((r) => r.studentId === id);
    if (!row || row.entryStatus === 'SUBMITTED') return;
    const next = presentStatus(row.status) ? 'ABSENT' : 'PRESENT';
    patchRow(id, {
      status: next,
      marks: next === 'ABSENT' ? '' : row.marks,
      remarks: next === 'ABSENT' && !row.remarks ? 'Absent' : row.remarks,
    });
  }

  function clearAll() {
    dirty.current = true;
    setRows((prev) =>
      prev.map((row) =>
        row.entryStatus === 'SUBMITTED'
          ? row
          : { ...row, marks: '', remarks: '', status: 'PRESENT' },
      ),
    );
  }

  function importCsv(text: string) {
    const table = parseCsv(text);
    const header = (table.shift() ?? []).map((h) => h.toLowerCase());
    const adm = header.findIndex((h) => h.includes('admission'));
    const marksI = header.findIndex((h) => h === 'marks' || h.includes('mark'));
    const statusI = header.findIndex((h) => h.includes('status'));
    const remarksI = header.findIndex((h) => h.includes('remark'));
    if (adm < 0) {
      setError('The spreadsheet needs an Admission No. column.');
      return;
    }
    let skipped = 0;
    dirty.current = true;
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      for (const cols of table) {
        const admission = cols[adm]?.trim();
        const target = next.find((r) => r.admissionNumber === admission);
        if (!target || target.entryStatus === 'SUBMITTED') {
          skipped += 1;
          continue;
        }
        const raw = marksI >= 0 ? cols[marksI] : '';
        const marks = raw === '' || raw == null ? '' : String(Number(raw));
        if (marks && (Number.isNaN(Number(marks)) || Number(marks) > maxMarks)) {
          skipped += 1;
          continue;
        }
        target.marks = marks === 'NaN' ? '' : marks;
        if (statusI >= 0) {
          const status = (cols[statusI] || 'PRESENT').toUpperCase();
          target.status = status.includes('ABSENT') ? 'ABSENT' : 'PRESENT';
        }
        if (remarksI >= 0) target.remarks = cols[remarksI] ?? '';
        if (!presentStatus(target.status)) target.marks = '';
      }
      return next;
    });
    setError(
      skipped
        ? `Import applied. ${skipped} row(s) could not be matched or exceeded maximum marks.`
        : null,
    );
    setOk(skipped ? null : 'Spreadsheet imported. Review and save marks.');
  }

  function exportTemplate() {
    const header = [
      'Admission No.',
      'Roll No.',
      'Student Name',
      'Class',
      'Section',
      'Subject',
      'Maximum Marks',
      'Marks',
      'Status',
      'Remarks',
    ];
    const body = rows.map((r) =>
      [
        r.admissionNumber,
        r.rollNumber,
        r.fullName,
        gradeName,
        asText(sections.find((s) => asText(s.id) === sectionId)?.name, ''),
        asText(selectedSubject?.name, ''),
        maxMarks,
        r.marks,
        presentStatus(r.status) ? 'PRESENT' : 'ABSENT',
        r.remarks,
      ]
        .map(csvEscape)
        .join(','),
    );
    const blob = new Blob([`${header.join(',')}\n${body.join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'marks-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const visible = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = `${row.fullName} ${row.admissionNumber} ${row.rollNumber}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (absentOnly && presentStatus(row.status)) return false;
    if (statusFilter === 'present' && !presentStatus(row.status)) return false;
    if (statusFilter === 'absent' && presentStatus(row.status)) return false;
    return true;
  });
  const presentCount = rows.filter((r) => presentStatus(r.status)).length;
  const absentCount = rows.length - presentCount;
  const scored = rows.filter((r) => presentStatus(r.status) && r.marks !== '');
  const nums = scored.map((r) => Number(r.marks)).filter((n) => Number.isFinite(n));
  const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
  const passCount = nums.filter((n) => n >= passMarks).length;
  const failCount = nums.filter((n) => n < passMarks).length;
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected[r.studentId]);

  return (
    <div className="sls-me">
      <div className="sls-me-head">
        <div className="flex items-start gap-3">
          <span className="sls-me-title-ico">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h1>Mark Entry</h1>
            <p>Enter and manage marks for the classes you are authorised to handle.</p>
          </div>
        </div>
        <div className="sls-me-head-right">
          <div className="sls-att-crumb">
            <Link href="/school-sis-portal/staff" aria-label="Home">
              <Home className="inline h-3.5 w-3.5" />
            </Link>
            <span>/</span>
            <Link href="/school-sis-portal/staff/exams">Examinations</Link>
            <span>/</span>
            Mark Entry
          </div>
          <p className="sls-me-assigned">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Only the classes and subjects assigned to you are shown.
          </p>
        </div>
      </div>

      <div className="sls-me-filters portal-card">
        <label>
          Exam *
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam</option>
            {exams.map((exam) => (
              <option key={asText(exam.id)} value={asText(exam.id)}>
                {asText(exam.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Class *
          <select
            value={gradeName}
            onChange={(e) => {
              setGradeName(e.target.value);
              setSectionId('');
            }}
          >
            <option value="">Select class</option>
            {classes.map((row) => (
              <option key={asText(row.gradeId)} value={asText(row.name)}>
                {asText(row.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section *
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Select section</option>
            {sections.map((row) => (
              <option key={asText(row.id)} value={asText(row.id)}>
                {asText(row.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject *
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select subject</option>
            {subjects.map((row) => (
              <option key={asText(row.id)} value={asText(row.id)}>
                {asText(row.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Component *
          <select value={componentId} onChange={(e) => setComponentId(e.target.value)}>
            <option value="">Select component</option>
            {components.map((row) => (
              <option key={asText(row.id)} value={asText(row.id)}>
                {asText(row.name)}
                {asNumber(row.maxMarks) ? ` (${asNumber(row.maxMarks)})` : ''}
              </option>
            ))}
          </select>
        </label>
        <aside className="sls-me-max">
          <Info className="h-4 w-4" />
          <div>
            <p>
              Maximum Marks: <strong>{maxMarks || '—'}</strong>
            </p>
            <p>
              Passing Marks: <strong>{passMarks || '—'}</strong>
            </p>
          </div>
        </aside>
      </div>

      <div className="sls-me-desk portal-card">
        <div className="sls-me-tabs">
          <div className="sls-me-tablist">
            {(
              [
                { id: 'entry', label: 'Marks Entry', icon: Pencil },
                { id: 'summary', label: 'Summary', icon: BarChart3 },
                { id: 'history', label: 'Previous Records', icon: Clock },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(tab === item.id && 'is-on')}
                onClick={() => setTab(item.id)}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
          <div className="sls-me-tools">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.name.toLowerCase().endsWith('.xlsx')) {
                  setError('Please export as CSV from Excel, then import that file.');
                  return;
                }
                importCsv(await file.text());
              }}
            />
            <button
              type="button"
              className="sls-me-ghost is-blue"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Import from Excel
            </button>
            <button
              type="button"
              className="sls-me-ghost is-green"
              onClick={exportTemplate}
              disabled={!rows.length}
            >
              <Download className="h-3.5 w-3.5" />
              Export Template
            </button>
            <button
              type="button"
              className="sls-me-ghost is-violet"
              onClick={() => setGuidelines(true)}
            >
              <Info className="h-3.5 w-3.5" />
              View Guidelines
            </button>
          </div>
        </div>

        {tab === 'entry' ? (
          <>
            <div className="sls-me-table-tools">
              <label className="sls-att-search">
                <Search className="h-4 w-4" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search student by name or admission no..."
                />
              </label>
              <div className="relative">
                <button
                  type="button"
                  className="sls-me-iconbtn"
                  aria-label="Filter"
                  onClick={() => setShowFilter((v) => !v)}
                >
                  <Filter className="h-4 w-4" />
                </button>
                {showFilter ? (
                  <div className="sls-me-pop">
                    <button
                      type="button"
                      className={cn(statusFilter === 'all' && 'is-on')}
                      onClick={() => setStatusFilter('all')}
                    >
                      All students
                    </button>
                    <button
                      type="button"
                      className={cn(statusFilter === 'present' && 'is-on')}
                      onClick={() => setStatusFilter('present')}
                    >
                      Present only
                    </button>
                    <button
                      type="button"
                      className={cn(statusFilter === 'absent' && 'is-on')}
                      onClick={() => setStatusFilter('absent')}
                    >
                      Absent only
                    </button>
                  </div>
                ) : null}
              </div>
              <label className="sls-me-toggle">
                <input
                  type="checkbox"
                  checked={absentOnly}
                  onChange={(e) => setAbsentOnly(e.target.checked)}
                />
                Show only absent students
              </label>
              <p className="sls-me-stats">
                Total Students: <strong>{rows.length}</strong>
                <span>
                  <i className="is-present" /> Present: {presentCount}
                </span>
                <span>
                  <i className="is-absent" /> Absent: {absentCount}
                </span>
              </p>
            </div>

            {roster.isLoading ? (
              <p className="portal-empty">Loading the class roster…</p>
            ) : !exams.length ? (
              <p className="portal-empty">
                No examinations are available for your classes yet. Ask the office to set up an
                exam.
              </p>
            ) : !rosterReady ? (
              <p className="portal-empty">
                Choose an exam, class, subject and component to load students.
              </p>
            ) : !visible.length ? (
              <p className="portal-empty">
                {rows.length
                  ? 'No students match the current search or filter.'
                  : 'No students are enrolled in this section yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="sls-me-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setSelected((prev) => {
                              const next = { ...prev };
                              for (const row of visible) next[row.studentId] = on;
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th>#</th>
                      <th>Admission No.</th>
                      <th>Student Name</th>
                      <th>Status</th>
                      <th>Marks {maxMarks ? `(/ ${maxMarks})` : ''}</th>
                      <th>Remarks (Optional)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row, i) => {
                      const locked = row.entryStatus === 'SUBMITTED';
                      const present = presentStatus(row.status);
                      return (
                        <tr key={row.studentId} className={cn(!present && 'is-absent')}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!selected[row.studentId]}
                              onChange={(e) =>
                                setSelected((prev) => ({
                                  ...prev,
                                  [row.studentId]: e.target.checked,
                                }))
                              }
                            />
                          </td>
                          <td>{i + 1}</td>
                          <td>{row.admissionNumber || '—'}</td>
                          <td className="font-semibold text-[var(--heading,#0f172a)]">
                            {row.fullName}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={cn('sls-me-status', present ? 'is-present' : 'is-absent')}
                              disabled={locked}
                              onClick={() => toggleStatus(row.studentId)}
                            >
                              {present ? 'Present' : 'Absent'}
                            </button>
                          </td>
                          <td>
                            <input
                              className="sls-me-marks"
                              inputMode="decimal"
                              disabled={locked || !present}
                              value={present ? row.marks : '—'}
                              placeholder={present ? '' : '—'}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                                  patchRow(row.studentId, { marks: value });
                                }
                              }}
                            />
                          </td>
                          <td>
                            <input
                              className="sls-me-remark"
                              disabled={locked}
                              value={row.remarks}
                              placeholder=""
                              onChange={(e) => patchRow(row.studentId, { remarks: e.target.value })}
                            />
                          </td>
                          <td>
                            <div
                              className="relative"
                              ref={menuId === row.studentId ? menuRef : undefined}
                            >
                              <button
                                type="button"
                                className="sls-me-iconbtn"
                                aria-label="Row actions"
                                onClick={() =>
                                  setMenuId((id) => (id === row.studentId ? null : row.studentId))
                                }
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {menuId === row.studentId ? (
                                <div className="sls-me-pop">
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => toggleStatus(row.studentId)}
                                  >
                                    Mark {present ? 'Absent' : 'Present'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={locked}
                                    onClick={() => {
                                      patchRow(row.studentId, { remarks: '' });
                                      setMenuId(null);
                                    }}
                                  >
                                    Clear remarks
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="sls-me-foot">
              <p>
                <Info className="h-4 w-4" />
                <span>
                  <strong>Note:</strong> Marks are saved automatically as you type. Click “Save
                  Marks” to confirm the entries.
                  {savingHint ? ` ${savingHint}.` : ''}
                  {selectedIds.length ? ` ${selectedIds.length} selected.` : ''}
                </span>
              </p>
              <div className="sls-me-foot-acts">
                {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                {ok ? <p className="text-sm text-emerald-600">{ok}</p> : null}
                <button
                  type="button"
                  className="sls-me-ghost is-rose"
                  onClick={clearAll}
                  disabled={!rows.length}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
                <button
                  type="button"
                  className="sls-btn-primary"
                  disabled={!rows.length || save.isPending}
                  onClick={() => {
                    const invalid = rows.some((row) => {
                      if (!presentStatus(row.status) || row.marks === '') return false;
                      const n = Number(row.marks);
                      return !Number.isFinite(n) || (maxMarks > 0 && n > maxMarks) || n < 0;
                    });
                    if (invalid) {
                      setError(`Marks cannot exceed ${maxMarks || 'the maximum'} or be negative.`);
                      return;
                    }
                    save.mutate(true);
                  }}
                >
                  Save Marks
                </button>
              </div>
            </div>
          </>
        ) : null}

        {tab === 'summary' ? (
          <div className="sls-me-summary">
            <article>
              <p>Entered</p>
              <strong>
                {scored.length}/{rows.length}
              </strong>
            </article>
            <article>
              <p>Average</p>
              <strong>{nums.length ? avg.toFixed(1) : '—'}</strong>
            </article>
            <article>
              <p>Passed</p>
              <strong>{passMarks ? passCount : '—'}</strong>
            </article>
            <article>
              <p>Failed</p>
              <strong>{passMarks ? failCount : '—'}</strong>
            </article>
            <article>
              <p>Highest</p>
              <strong>{nums.length ? Math.max(...nums) : '—'}</strong>
            </article>
            <article>
              <p>Lowest</p>
              <strong>{nums.length ? Math.min(...nums) : '—'}</strong>
            </article>
          </div>
        ) : null}

        {tab === 'history' ? (
          <div className="overflow-x-auto">
            {history.isLoading ? (
              <p className="portal-empty">Loading previous records…</p>
            ) : !rosterReady ? (
              <p className="portal-empty">
                Choose an exam, class, subject and component to see previous records.
              </p>
            ) : (
              <table className="sls-me-table">
                <thead>
                  <tr>
                    <th>Admission No.</th>
                    <th>Student Name</th>
                    {asList(asRecord(history.data).components).map((comp) => {
                      const item = asRecord(comp);
                      return (
                        <th key={asText(item.id)}>
                          {asText(item.name)}
                          {asNumber(item.maxMarks) ? ` / ${asNumber(item.maxMarks)}` : ''}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {asList(asRecord(history.data).rows).map((row) => {
                    const item = asRecord(row);
                    return (
                      <tr key={asText(item.studentId)}>
                        <td>{asText(item.admissionNumber)}</td>
                        <td className="font-semibold">{asText(item.fullName)}</td>
                        {asList(item.scores).map((score) => {
                          const s = asRecord(score);
                          const status = asText(s.status, '');
                          return (
                            <td key={asText(s.componentId)}>
                              {!presentStatus(status) && status
                                ? status.charAt(0) + status.slice(1).toLowerCase()
                                : s.marks == null
                                  ? '—'
                                  : asText(s.marks)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </div>

      {guidelines ? (
        <div className="sls-me-modal" role="dialog" aria-modal="true">
          <div className="sls-me-modal-card portal-card">
            <div className="flex items-start justify-between gap-3">
              <h2>Mark entry guidelines</h2>
              <button
                type="button"
                className="sls-me-iconbtn"
                onClick={() => setGuidelines(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul>
              <li>Enter marks out of the component maximum shown on this page.</li>
              <li>
                Mark a student Absent if they did not sit the paper. Do not enter zero for absence.
              </li>
              <li>Drafts save as you type. Save Marks confirms the class entry.</li>
              <li>Submitted marks stay locked until an administrator reopens them.</li>
              <li>Import uses a CSV template with Admission No., Marks, Status and Remarks.</li>
            </ul>
            <button type="button" className="sls-btn-primary" onClick={() => setGuidelines(false)}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
