'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bold,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  Italic,
  Link2,
  List,
  ListOrdered,
  NotebookPen,
  Pencil,
  Search,
  Trash2,
  Underline,
} from 'lucide-react';
import {
  deleteSchoolHomework,
  duplicateSchoolHomework,
  fetchSchoolHomeworkList,
  fetchSchoolHomeworkOptions,
  fetchSchoolHomeworkReports,
  saveSchoolHomework,
} from '@/services/school-sis-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { asList, asNumber, asRecord, asText } from './portal-utils';

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function prettyDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type HomeworkItem = {
  id: string;
  title: string;
  body: string;
  assignDate: string;
  dueDate: string;
  status: string;
  listStatus: string;
  visibleTo: string;
  sectionId: string;
  subjectId: string;
  classLabel: string;
  subjectName: string;
  submitted: number;
  enrolled: number;
};

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'draft', label: 'Drafts' },
] as const;

export function StaffHomeworkPage() {
  const authed = useAuthQueryEnabled();
  const qc = useQueryClient();
  const today = isoToday();
  const [grade, setGrade] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [assignDate, setAssignDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDays(today, 7));
  const [visibleTo, setVisibleTo] = useState('STUDENTS');
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  const [showReports, setShowReports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const options = useQuery({
    queryKey: ['school-hw-options'],
    queryFn: fetchSchoolHomeworkOptions,
    enabled: authed,
  });
  const list = useQuery({
    queryKey: ['school-hw-list'],
    queryFn: fetchSchoolHomeworkList,
    enabled: authed,
  });
  const reports = useQuery({
    queryKey: ['school-hw-reports'],
    queryFn: fetchSchoolHomeworkReports,
    enabled: authed && showReports,
  });

  const classes = asList(asRecord(options.data).classes).map(asRecord);
  const subjects = asList(asRecord(options.data).subjects).map(asRecord);
  const selectedClass = classes.find((c) => asText(c.name) === grade);
  const selectedGradeId = asText(selectedClass?.gradeId, '');
  const sections = useMemo(() => asList(selectedClass?.sections).map(asRecord), [selectedClass]);
  const subjectOpts = useMemo(() => {
    const seen = new Set<string>();
    return subjects.filter((s) => {
      const id = asText(s.id, '');
      if (!id || seen.has(id)) return false;
      const gid = asText(s.gradeId, '');
      if (selectedGradeId && gid && gid !== selectedGradeId) return false;
      seen.add(id);
      return true;
    });
  }, [subjects, selectedGradeId]);

  const items = asList(asRecord(list.data).items).map((row) => {
    const item = asRecord(row);
    return {
      id: asText(item.id, ''),
      title: asText(item.title, ''),
      body: asText(item.body, ''),
      assignDate: asText(item.assignDate, ''),
      dueDate: asText(item.dueDate, ''),
      status: asText(item.status, ''),
      listStatus: asText(item.listStatus, ''),
      visibleTo: asText(item.visibleTo, 'STUDENTS'),
      sectionId: asText(item.sectionId, ''),
      subjectId: asText(item.subjectId, ''),
      classLabel: asText(item.classLabel, ''),
      subjectName: asText(item.subjectName, '—'),
      submitted: asNumber(item.submitted),
      enrolled: asNumber(item.enrolled),
    } satisfies HomeworkItem;
  });
  const kpis = asRecord(asRecord(list.data).kpis);
  const filtered = items.filter((row) => {
    if (tab !== 'all' && row.listStatus !== tab) return false;
    const hay = `${row.title} ${row.subjectName} ${row.classLabel}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setAssignDate(today);
    setDueDate(addDays(today, 7));
    setVisibleTo('STUDENTS');
    setFiles([]);
    setSubjectId('');
  };

  const fillForm = (row: HomeworkItem) => {
    const match = classes.find((c) =>
      asList(c.sections)
        .map(asRecord)
        .some((s) => asText(s.id) === row.sectionId),
    );
    setGrade(asText(match?.name, row.classLabel.replace(/\s+\S+$/, '')));
    setSectionId(row.sectionId);
    setSubjectId(row.subjectId);
    setTitle(row.title);
    setBody(row.body);
    setAssignDate(row.assignDate);
    setDueDate(row.dueDate);
    setVisibleTo(row.visibleTo);
    setFiles([]);
    setEditingId(row.id);
  };

  const wrap = (before: string, after = before) => {
    setBody((cur) => `${cur}${cur && !cur.endsWith('\n') ? '\n' : ''}${before}text${after}`);
  };

  const save = useMutation({
    mutationFn: (asDraft: boolean) => {
      const form = new FormData();
      form.set('sectionId', sectionId);
      if (subjectId) form.set('subjectId', subjectId);
      form.set('title', title.trim());
      form.set('body', body);
      form.set('assignDate', assignDate);
      form.set('dueDate', dueDate);
      form.set('visibleTo', visibleTo);
      form.set('asDraft', asDraft ? 'true' : 'false');
      for (const file of files) form.append('files', file);
      return saveSchoolHomework(form, editingId || undefined);
    },
    onError: (err) => {
      setOk(null);
      setError(apiErrorMessage(err));
    },
    onSuccess: (_data, asDraft) => {
      setError(null);
      setOk(asDraft ? 'Draft saved.' : 'Homework assigned.');
      resetForm();
      void qc.invalidateQueries({ queryKey: ['school-hw-list'] });
      void qc.invalidateQueries({ queryKey: ['school-hw-reports'] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteSchoolHomework,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-hw-list'] });
    },
  });
  const copy = useMutation({
    mutationFn: duplicateSchoolHomework,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-hw-list'] });
    },
  });

  return (
    <div className="sls-hw">
      <div className="sls-hw-head">
        <div className="flex items-start gap-3">
          <span className="sls-hw-title-ico">
            <NotebookPen className="h-5 w-5" />
          </span>
          <div>
            <h1>Homework</h1>
            <p>Create and manage homework assignments for your classes</p>
          </div>
        </div>
        <div className="sls-hw-head-right">
          <div className="sls-att-crumb">
            <Link href="/school-sis-portal/staff">Classroom</Link>
            <span>/</span>
            Homework
          </div>
          <button type="button" className="sls-hw-ghost" onClick={() => setShowReports((v) => !v)}>
            Homework Reports
          </button>
        </div>
      </div>

      <div className="sls-hw-kpis">
        <Kpi
          label="Total Assignments"
          value={asNumber(kpis.total)}
          tone="violet"
          icon={ClipboardList}
        />
        <Kpi
          label="Active Assignments"
          value={asNumber(kpis.active)}
          tone="green"
          icon={CheckCircle2}
        />
        <Kpi
          label="Pending Review"
          value={asNumber(kpis.pendingReview || kpis.pending)}
          tone="amber"
          icon={Clock}
        />
        <Kpi label="Past Assignments" value={asNumber(kpis.past)} tone="rose" icon={CalendarDays} />
      </div>

      {showReports ? (
        <section className="portal-card sls-hw-form">
          <h2>Homework Reports</h2>
          <div className="overflow-x-auto">
            <table className="sls-hw-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Total</th>
                  <th>Active</th>
                  <th>Pending</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {asList(asRecord(reports.data).byClass).map((row) => {
                  const item = asRecord(row);
                  return (
                    <tr key={asText(item.classLabel)}>
                      <td>{asText(item.classLabel)}</td>
                      <td>{asNumber(item.total)}</td>
                      <td>{asNumber(item.active)}</td>
                      <td>{asNumber(item.pending)}</td>
                      <td>{asNumber(item.completed)}</td>
                    </tr>
                  );
                })}
                {!asList(asRecord(reports.data).byClass).length ? (
                  <tr>
                    <td colSpan={5}>No homework to summarise yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="portal-card sls-hw-form" id="sls-hw-create">
        <div className="sls-hw-form-head">
          <h2>
            <ClipboardList className="h-4 w-4" /> Create New Homework
          </h2>
          <button
            type="button"
            className="sls-hw-ghost"
            disabled={save.isPending || !sectionId || !title.trim()}
            onClick={() => save.mutate(true)}
          >
            Save as Draft
          </button>
        </div>
        <div className="sls-hw-grid">
          <label>
            Class *
            <select
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setSectionId('');
                setSubjectId('');
              }}
            >
              <option value="">Select Class</option>
              {classes.map((row) => (
                <option key={asText(row.name, '')} value={asText(row.name, '')}>
                  {asText(row.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Section *
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Select Section</option>
              {sections.map((row) => (
                <option key={asText(row.id, '')} value={asText(row.id, '')}>
                  {asText(row.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Select Subject</option>
              {subjectOpts.map((row) => (
                <option key={asText(row.id, '')} value={asText(row.id, '')}>
                  {asText(row.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Homework Title *
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 2 - Exercise 1"
            />
          </label>
          <label className="sls-hw-span">
            Description / Instructions
            <div className="sls-hw-toolbar">
              <button type="button" onClick={() => wrap('**', '**')} aria-label="Bold">
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => wrap('_', '_')} aria-label="Italic">
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => wrap('<u>', '</u>')} aria-label="Underline">
                <Underline className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => wrap('- ')} aria-label="Bullet list">
                <List className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => wrap('1. ')} aria-label="Numbered list">
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => wrap('[', '](https://)')} aria-label="Link">
                <Link2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type homework details, instructions, page numbers, questions etc..."
            />
          </label>
          <label>
            Assign Date
            <input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} />
          </label>
          <label>
            Due Date
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label>
            Attachments (Optional)
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            <span className="sls-hw-hint">
              {files.length
                ? `${files.length} file(s) selected`
                : 'You can upload PDF, DOC, DOCX, JPG or PNG (Max 5 MB each)'}
            </span>
          </label>
          <fieldset>
            <legend>Visible To</legend>
            <label className="sls-hw-radio">
              <input
                type="radio"
                checked={visibleTo === 'STUDENTS'}
                onChange={() => setVisibleTo('STUDENTS')}
              />
              Students only
            </label>
            <label className="sls-hw-radio">
              <input
                type="radio"
                checked={visibleTo === 'STUDENTS_PARENTS'}
                onChange={() => setVisibleTo('STUDENTS_PARENTS')}
              />
              Students & Parents
            </label>
          </fieldset>
        </div>
        <div className="sls-hw-form-foot">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {ok ? <p className="text-sm text-emerald-600">{ok}</p> : null}
          {editingId ? (
            <button type="button" className="sls-hw-ghost" onClick={resetForm}>
              Cancel edit
            </button>
          ) : null}
          <button
            type="button"
            className="sls-btn-primary"
            disabled={save.isPending || !sectionId || !title.trim()}
            onClick={() => save.mutate(false)}
          >
            {editingId ? 'Update Homework' : 'Assign Homework'}
          </button>
        </div>
      </section>

      <section className="portal-card sls-hw-list">
        <div className="sls-hw-list-head">
          <h2>
            <ClipboardList className="h-4 w-4" /> Homework List
          </h2>
          <label className="sls-att-search">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search homework by title, subject or class..."
            />
          </label>
        </div>
        <div className="sls-hw-tabs">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(tab === item.id && 'is-on')}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="sls-hw-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Assign Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Submissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.id}>
                  <td>{i + 1}</td>
                  <td className="font-semibold">{row.title}</td>
                  <td>{row.classLabel}</td>
                  <td>{row.subjectName}</td>
                  <td>{prettyDate(row.assignDate)}</td>
                  <td>{prettyDate(row.dueDate)}</td>
                  <td>
                    <span className={cn('sls-hw-status', `is-${row.listStatus}`)}>
                      {row.listStatus === 'draft'
                        ? 'Draft'
                        : row.listStatus
                          ? row.listStatus[0].toUpperCase() + row.listStatus.slice(1)
                          : '—'}
                    </span>
                  </td>
                  <td>
                    {row.submitted} / {row.enrolled}
                  </td>
                  <td>
                    <span className="sls-hw-acts">
                      <button
                        type="button"
                        aria-label="View"
                        onClick={() => {
                          fillForm(row);
                          document.getElementById('sls-hw-create')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => {
                          fillForm(row);
                          document.getElementById('sls-hw-create')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Duplicate"
                        onClick={() => copy.mutate(row.id)}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        aria-label="Delete"
                        onClick={() => {
                          if (window.confirm('Delete this homework?')) remove.mutate(row.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={9}>No homework in this list yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: 'violet' | 'green' | 'amber' | 'rose';
  icon: typeof ClipboardList;
}) {
  return (
    <div className={cn('sls-hw-kpi', `is-${tone}`)}>
      <span className="sls-hw-kpi-ico">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </div>
  );
}
