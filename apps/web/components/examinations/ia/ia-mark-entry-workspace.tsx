'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  HelpCircle,
  History,
  List,
  Loader2,
  Save,
  Search,
  Settings2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import {
  fetchFacultyIaSubjects,
  fetchIaExams,
  fetchIaPapers,
  fetchIaRoster,
  importIaMarks,
  saveIaMarks,
  type IaExamSummary,
  type IaPaper,
} from '@/services/examinations-ia';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type MarkCell = {
  componentId: string;
  code: string;
  label: string;
  maxMarks: number;
  marks: number | null;
  remarks?: string;
  updatedAt?: string | null;
};

type RosterStudent = {
  id: string;
  rollNumber?: string | null;
  fullName?: string | null;
  shiftId?: string | null;
  shiftName?: string | null;
  marks: MarkCell[];
};

type PreviousMark = {
  studentId: string;
  examName: string;
  examType?: string | null;
  paperCode: string;
  paperName?: string;
  componentLabel: string;
  marks: number | null;
  maxMarks: number | null;
};

type RosterResponse = {
  scheme?: {
    id: string;
    name?: string;
    totalMaxMarks: number | string;
    passMark?: number | string | null;
    components?: Array<{ id: string; code: string; label: string; maxMarks: number | string }>;
  };
  context?: {
    sessionName?: string | null;
    examType?: string | null;
    academicYearName?: string | null;
    shiftName?: string | null;
    departmentName?: string | null;
    courseType?: string | null;
    credits?: number | null;
    maxMarks?: number | null;
  };
  previousMarks?: PreviousMark[];
  students?: RosterStudent[];
};

type PaperChoice = {
  id: string;
  sessionId: string;
  sessionName: string;
  examType: string;
  academicYearId: string;
  academicYearName: string;
  semesterNo: number | null;
  paperCode: string;
  paperName: string;
  departmentId: string;
  departmentName: string;
  courseType: string | null;
  credits: number | null;
  maxMarks: number | null;
};

type FacultySubject = {
  courseCode: string;
  courseName: string;
  credits?: number | null;
  courseType?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  semesterNo?: number | null;
  papers?: Array<
    IaPaper & {
      sessionName?: string | null;
      examType?: string | null;
      academicYearId?: string | null;
      academicYearName?: string | null;
      shiftName?: string | null;
      metadata?: { category?: string; maxMarks?: number } | null;
    }
  >;
};

const PAGE_SIZES = [10, 25, 50, 100];

function examTypeLabel(value?: string | null) {
  return (value || 'IA').replace(/_/g, ' ');
}

function prettyToken(value?: string | null) {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCredits(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(number);
}

function formatUpdated(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${hour12}:${minutes} ${suffix}`;
}

function compareRoll(a?: string | null, b?: string | null) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function paperChoiceFromExam(exam: IaExamSummary, paper: IaPaper): PaperChoice {
  const meta = paper.metadata ?? {};
  return {
    id: paper.id,
    sessionId: exam.id,
    sessionName: exam.name,
    examType: exam.examType,
    academicYearId: exam.academicYearId ?? '',
    academicYearName: exam.stats?.academicYearName || '—',
    semesterNo: paper.semesterNo ?? null,
    paperCode: paper.paperCode,
    paperName: paper.paperName,
    departmentId: paper.course?.departmentId || 'none',
    departmentName: paper.course?.departmentName || 'Unassigned',
    courseType: meta.category || paper.course?.courseType || null,
    credits: paper.course?.credits ?? null,
    maxMarks: meta.maxMarks ?? exam.stats?.maxMarks ?? exam.metadata?.maxMarks ?? null,
  };
}

export function IaMarkEntryWorkspace({
  staffMode = false,
  initialPaperId,
}: {
  staffMode?: boolean;
  initialPaperId?: string;
}) {
  const qc = useQueryClient();
  const exams = useQuery({
    queryKey: ['ia', 'exams'],
    queryFn: fetchIaExams,
    enabled: !staffMode,
  });
  const subjects = useQuery({
    queryKey: ['ia', 'faculty-subjects'],
    queryFn: fetchFacultyIaSubjects,
    enabled: staffMode,
  });

  const [yearId, setYearId] = useState('all');
  const [examId, setExamId] = useState('');
  const [semester, setSemester] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [paperId, setPaperId] = useState(initialPaperId ?? '');
  const [tab, setTab] = useState<'students' | 'settings' | 'previous' | 'import'>('students');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [shift, setShift] = useState('all');
  const [sortBy, setSortBy] = useState<'roll' | 'name'>('roll');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [draftMarks, setDraftMarks] = useState<Record<string, number | null>>({});
  const [draftRemarks, setDraftRemarks] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const shiftPinned = useRef('');
  const yearTouched = useRef(false);

  const staffPapers = useMemo((): PaperChoice[] => {
    return ((subjects.data ?? []) as FacultySubject[]).flatMap((subject) =>
      (subject.papers ?? []).map((paper) => ({
        id: paper.id,
        sessionId: paper.sessionId,
        sessionName: paper.sessionName || 'Assigned examination',
        examType: paper.examType || 'IA',
        academicYearId: paper.academicYearId || '',
        academicYearName: paper.academicYearName || '—',
        semesterNo: paper.semesterNo ?? subject.semesterNo ?? null,
        paperCode: paper.paperCode,
        paperName: paper.paperName,
        departmentId: subject.departmentId || 'none',
        departmentName: subject.departmentName || 'Unassigned',
        courseType: paper.metadata?.category || subject.courseType || null,
        credits: subject.credits ?? null,
        maxMarks: paper.metadata?.maxMarks ?? null,
      })),
    );
  }, [subjects.data]);

  const examOptions = useMemo(() => {
    if (staffMode) {
      const map = new Map<string, PaperChoice>();
      for (const paper of staffPapers) {
        if (yearId !== 'all' && paper.academicYearId && paper.academicYearId !== yearId) continue;
        if (!map.has(paper.sessionId)) map.set(paper.sessionId, paper);
      }
      return [...map.values()];
    }
    return (exams.data ?? []).filter(
      (exam) => yearId === 'all' || !exam.academicYearId || exam.academicYearId === yearId,
    );
  }, [staffMode, staffPapers, exams.data, yearId]);

  const yearOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const exam of exams.data ?? []) {
      if (exam.academicYearId) {
        map.set(exam.academicYearId, exam.stats?.academicYearName || exam.academicYearId);
      }
    }
    for (const paper of staffPapers) {
      if (paper.academicYearId) map.set(paper.academicYearId, paper.academicYearName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [exams.data, staffPapers]);

  useEffect(() => {
    if (yearTouched.current || staffMode || yearId !== 'all' || !exams.data?.length) return;
    const preferred = exams.data.find((exam) => exam.status === 'SCHEDULED') ?? exams.data[0];
    if (preferred?.academicYearId) setYearId(preferred.academicYearId);
  }, [exams.data, staffMode, yearId]);

  useEffect(() => {
    const ids = staffMode
      ? (examOptions as PaperChoice[]).map((exam) => exam.sessionId)
      : (examOptions as IaExamSummary[]).map((exam) => exam.id);
    if (examId && ids.includes(examId)) return;
    if (staffMode) {
      const preferred = staffPapers.find((paper) => paper.id === initialPaperId) ?? staffPapers[0];
      if (preferred) setExamId(preferred.sessionId);
      return;
    }
    const pool = (examOptions as IaExamSummary[]).length
      ? (examOptions as IaExamSummary[])
      : (exams.data ?? []);
    const preferred =
      pool.find((exam) => exam.status === 'SCHEDULED') ??
      pool.find((exam) => exam.status !== 'EXPIRED' && exam.status !== 'CANCELLED') ??
      pool[0];
    if (preferred) setExamId(preferred.id);
  }, [examId, examOptions, exams.data, initialPaperId, staffMode, staffPapers]);

  const papers = useQuery({
    queryKey: ['ia', 'papers', examId],
    queryFn: () => fetchIaPapers({ sessionId: examId }),
    enabled: !staffMode && Boolean(examId),
  });

  const paperChoices = useMemo((): PaperChoice[] => {
    if (staffMode) return staffPapers.filter((paper) => paper.sessionId === examId);
    const exam = (exams.data ?? []).find((row) => row.id === examId);
    if (!exam) return [];
    return (papers.data ?? []).map((paper) => paperChoiceFromExam(exam, paper));
  }, [staffMode, staffPapers, examId, exams.data, papers.data]);

  const semesters = useMemo(
    () =>
      [
        ...new Set(
          paperChoices.map((paper) => paper.semesterNo).filter((n): n is number => n != null),
        ),
      ].sort((a, b) => a - b),
    [paperChoices],
  );
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const paper of paperChoices) {
      if (!semester || String(paper.semesterNo ?? '') === semester) {
        map.set(paper.departmentId, paper.departmentName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [paperChoices, semester]);

  const subjectChoices = useMemo(
    () =>
      paperChoices
        .filter((paper) => !semester || String(paper.semesterNo ?? '') === semester)
        .filter((paper) => departmentId === 'all' || paper.departmentId === departmentId)
        .sort((a, b) => a.paperCode.localeCompare(b.paperCode)),
    [paperChoices, semester, departmentId],
  );

  useEffect(() => {
    if (!semesters.length) return;
    if (!semester || !semesters.includes(Number(semester))) {
      const initial = paperChoices.find((paper) => paper.id === initialPaperId);
      setSemester(String(initial?.semesterNo ?? semesters[0]));
    }
  }, [semesters, semester, paperChoices, initialPaperId]);

  useEffect(() => {
    if (!subjectChoices.length) return;
    if (!subjectChoices.some((paper) => paper.id === paperId)) {
      const initial = subjectChoices.find((paper) => paper.id === initialPaperId);
      setPaperId(initial?.id ?? subjectChoices[0].id);
    }
  }, [subjectChoices, paperId, initialPaperId]);

  const selectedPaper =
    subjectChoices.find((paper) => paper.id === paperId) ??
    paperChoices.find((paper) => paper.id === paperId);
  const selectedExam = staffMode
    ? (examOptions as PaperChoice[]).find((exam) => exam.sessionId === examId)
    : (exams.data ?? []).find((exam) => exam.id === examId);

  const roster = useQuery({
    queryKey: ['ia', 'roster', paperId],
    queryFn: () => fetchIaRoster(paperId) as Promise<RosterResponse>,
    enabled: Boolean(paperId),
  });

  useEffect(() => {
    if (!roster.data || !paperId || shiftPinned.current === paperId) return;
    shiftPinned.current = paperId;
    const name = roster.data.context?.shiftName;
    if (name && (roster.data.students ?? []).some((student) => student.shiftName === name)) {
      setShift(name);
    } else {
      setShift('all');
    }
    setPage(1);
    setDraftMarks({});
    setDraftRemarks({});
    setSelected({});
  }, [roster.data, paperId]);

  const schemeId = roster.data?.scheme?.id ?? '';
  const components = roster.data?.scheme?.components ?? [];
  const students = roster.data?.students ?? [];

  const valueFor = (student: RosterStudent, cell: MarkCell) => {
    const key = `${student.id}:${cell.componentId}`;
    return key in draftMarks ? draftMarks[key] : cell.marks;
  };
  const remarksFor = (student: RosterStudent) =>
    student.id in draftRemarks
      ? draftRemarks[student.id]
      : (student.marks.find((cell) => cell.remarks)?.remarks ?? '');
  const savedRemarks = (student: RosterStudent) =>
    student.marks.find((cell) => cell.remarks)?.remarks ?? '';
  const isDirty = (student: RosterStudent) =>
    student.marks.some((cell) => `${student.id}:${cell.componentId}` in draftMarks) ||
    student.id in draftRemarks;
  const rowStatus = (student: RosterStudent) => {
    if (isDirty(student)) return 'unsaved';
    if (student.marks.some((cell) => cell.marks != null)) return 'saved';
    return 'pending';
  };

  const shiftOptions = useMemo(
    () =>
      [
        ...new Set(
          students
            .map((student) => student.shiftName)
            .filter((name): name is string => Boolean(name)),
        ),
      ].sort(),
    [students],
  );

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = students.filter((student) => {
      if (shift !== 'all' && student.shiftName !== shift) return false;
      if (statusFilter !== 'all' && rowStatus(student) !== statusFilter) return false;
      if (!query) return true;
      return (
        String(student.rollNumber ?? '')
          .toLowerCase()
          .includes(query) ||
        String(student.fullName ?? '')
          .toLowerCase()
          .includes(query)
      );
    });
    rows.sort((a, b) =>
      sortBy === 'name'
        ? String(a.fullName ?? '').localeCompare(String(b.fullName ?? ''))
        : compareRoll(a.rollNumber, b.rollNumber),
    );
    return rows;
  }, [students, search, shift, statusFilter, sortBy, draftMarks, draftRemarks]);

  const pageCount = Math.max(1, Math.ceil(visibleStudents.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = visibleStudents.slice((safePage - 1) * pageSize, safePage * pageSize);
  const shiftStudents = students.filter(
    (student) => shift === 'all' || student.shiftName === shift,
  );
  const enteredCount = shiftStudents.filter((student) =>
    student.marks.some((cell) => cell.marks != null),
  ).length;
  const pendingCount = Math.max(0, shiftStudents.length - enteredCount);
  const completion = shiftStudents.length
    ? Math.round((enteredCount / shiftStudents.length) * 1000) / 10
    : 0;
  const dirtyCount = students.filter(isDirty).length;

  const context = roster.data?.context;
  const maxMarks = Number(
    roster.data?.scheme?.totalMaxMarks ?? context?.maxMarks ?? selectedPaper?.maxMarks ?? 0,
  );
  const courseType = context?.courseType || selectedPaper?.courseType;
  const credits = context?.credits ?? selectedPaper?.credits;
  const examName =
    context?.sessionName ||
    (selectedExam && 'name' in selectedExam ? selectedExam.name : selectedExam?.sessionName) ||
    '—';
  const examType = context?.examType || selectedPaper?.examType || selectedExam?.examType;

  const buildRows = (studentIds?: string[]) => {
    const allowed = studentIds ? new Set(studentIds) : null;
    const rows: Array<{
      studentId: string;
      componentId: string;
      marks: number | null;
      remarks: string;
    }> = [];
    for (const student of students) {
      if (allowed && !allowed.has(student.id)) continue;
      if (!isDirty(student)) continue;
      const remarks = remarksFor(student);
      for (const cell of student.marks) {
        const marks = valueFor(student, cell);
        if (marks != null && marks > cell.maxMarks) {
          throw new Error(
            `Marks for ${student.rollNumber || student.fullName} cannot exceed ${cell.maxMarks}.`,
          );
        }
        rows.push({
          studentId: student.id,
          componentId: cell.componentId,
          marks,
          remarks,
        });
      }
    }
    return rows;
  };

  const save = useMutation({
    mutationFn: (studentIds?: string[]) => {
      if (!schemeId) throw new Error('No mark scheme is linked to this paper.');
      const rows = buildRows(studentIds);
      if (!rows.length) throw new Error('There are no unsaved marks to store.');
      return saveIaMarks(paperId, { schemeId, rows });
    },
    onSuccess: (result: { saved?: number }) => {
      setNotice(`Saved ${result?.saved ?? 0} mark${result?.saved === 1 ? '' : 's'}.`);
      setDraftMarks({});
      setDraftRemarks({});
      qc.invalidateQueries({ queryKey: ['ia', 'roster', paperId] });
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'Unable to save marks.')),
  });

  const onImportCsv = async (file: File) => {
    if (!schemeId) {
      setNotice('No mark scheme is linked to this paper.');
      return;
    }
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/).slice(1);
    const rows = lines
      .map((line) => line.split(','))
      .filter((cols) => cols.length >= 3)
      .map(([rollNumber, componentCode, marks]) => ({
        rollNumber: rollNumber.trim(),
        componentCode: componentCode.trim(),
        marks: Number(marks),
      }));
    try {
      const result = await importIaMarks(paperId, { schemeId, rows });
      setNotice(`Imported ${result?.saved ?? rows.length} marks.`);
      qc.invalidateQueries({ queryKey: ['ia', 'roster', paperId] });
    } catch (error) {
      setNotice(apiErrorMessage(error, 'Unable to import the CSV.'));
    }
  };

  const exportCsv = () => {
    const headers = [
      'Roll Number',
      'Student Name',
      'Shift',
      ...components.map((cell) => cell.label),
      'Remarks',
    ];
    const lines = visibleStudents.map((student) => [
      student.rollNumber ?? '',
      student.fullName ?? '',
      student.shiftName ?? '',
      ...student.marks.map((cell) => {
        const value = valueFor(student, cell);
        return value == null ? '' : String(value);
      }),
      remarksFor(student),
    ]);
    const csv = [headers, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedPaper?.paperCode || 'ia'}-marks.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFiltersForExam = (nextExamId: string) => {
    setExamId(nextExamId);
    setSemester('');
    setDepartmentId('all');
    setPaperId('');
    setPage(1);
    setSearch('');
  };

  const loading = staffMode ? subjects.isLoading : exams.isLoading;
  const loadError = staffMode ? subjects.error : exams.error;
  const pageStart = visibleStudents.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(safePage * pageSize, visibleStudents.length);
  const allPageSelected = pageRows.length > 0 && pageRows.every((student) => selected[student.id]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">
            NEHU Internal Assessment
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Mark Entry</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter and manage internal assessment marks for Don Bosco College Tura.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-400">
            {staffMode ? (
              <>
                <Link href="/staff/academic" className="hover:text-slate-600">
                  Staff
                </Link>
                <span className="mx-1.5">/</span>
                <span>Internal Assessment</span>
              </>
            ) : (
              <>
                <Link href="/admin" className="hover:text-slate-600">
                  Dashboard
                </Link>
                <span className="mx-1.5">/</span>
                <Link href="/admin/academics/examinations" className="hover:text-slate-600">
                  Examination
                </Link>
              </>
            )}
            <span className="mx-1.5">/</span>
            <span className="font-medium text-slate-600">Mark Entry</span>
          </p>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Help
          </button>
        </div>
      </header>

      {loading ? <p className="text-sm text-slate-500">Loading examinations…</p> : null}
      {loadError ? (
        <QueryErrorPanel
          title="Unable to load examinations"
          error={loadError}
          onRetry={() => void (staffMode ? subjects.refetch() : exams.refetch())}
          isRetrying={staffMode ? subjects.isFetching : exams.isFetching}
        />
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <FilterCard
          index={1}
          label="Examination"
          required
          caption={examType ? `Type: ${examTypeLabel(examType)}` : undefined}
        >
          <select
            value={examId}
            onChange={(event) => {
              const next = event.target.value;
              if (staffMode) resetFiltersForExam(next);
              else {
                resetFiltersForExam(next);
              }
            }}
            className={selectClass}
          >
            {staffMode
              ? (examOptions as PaperChoice[]).map((exam) => (
                  <option key={exam.sessionId} value={exam.sessionId}>
                    {exam.sessionName}
                  </option>
                ))
              : (examOptions as IaExamSummary[]).map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
          </select>
        </FilterCard>
        <FilterCard index={2} label="Academic Year" required>
          <select
            value={yearId}
            onChange={(event) => {
              yearTouched.current = true;
              setYearId(event.target.value);
              setExamId('');
              setSemester('');
              setDepartmentId('all');
              setPaperId('');
            }}
            className={selectClass}
          >
            <option value="all">All</option>
            {yearOptions.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </FilterCard>
        <FilterCard index={3} label="Semester" required>
          <select
            value={semester}
            onChange={(event) => {
              setSemester(event.target.value);
              setDepartmentId('all');
              setPaperId('');
              setPage(1);
            }}
            className={selectClass}
          >
            {semesters.map((item) => (
              <option key={item} value={item}>
                {item} Semester
              </option>
            ))}
          </select>
        </FilterCard>
        <FilterCard index={4} label="Department" required>
          <select
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setPaperId('');
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </FilterCard>
        <FilterCard
          index={5}
          label="Subject / Paper"
          required
          caption={
            selectedPaper
              ? `Max Marks: ${maxMarks || '—'}  |  Components: ${components.length || '—'}`
              : undefined
          }
        >
          <select
            value={paperId}
            onChange={(event) => {
              setPaperId(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            {subjectChoices.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.paperCode} — {paper.paperName}
              </option>
            ))}
          </select>
        </FilterCard>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))]">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {selectedPaper
                ? `${selectedPaper.paperCode} — ${selectedPaper.paperName}`
                : 'Select a paper'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Course Type: {prettyToken(courseType)} <span className="mx-1 text-slate-300">|</span>{' '}
              Credits: {formatCredits(credits)} <span className="mx-1 text-slate-300">|</span> Max
              Marks: {maxMarks || '—'}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">Examination: {examName}</p>
          </div>
        </div>
        <StatTile
          tone="blue"
          icon={<Users className="h-4 w-4" />}
          label="Total Students"
          value={shiftStudents.length}
          hint="Registered for this paper"
        />
        <StatTile
          tone="green"
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Marks Entered"
          value={enteredCount}
          hint={`${completion}% completed`}
        />
        <StatTile
          tone="amber"
          icon={<Clock3 className="h-4 w-4" />}
          label="Pending"
          value={pendingCount}
          hint={
            shiftStudents.length
              ? `${Math.max(0, Math.round((100 - completion) * 10) / 10)}% remaining`
              : '0% remaining'
          }
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <TabButton
          active={tab === 'students'}
          onClick={() => setTab('students')}
          icon={<List className="h-4 w-4" />}
        >
          Student List
        </TabButton>
        <TabButton
          active={tab === 'settings'}
          onClick={() => setTab('settings')}
          icon={<Settings2 className="h-4 w-4" />}
        >
          Mark Entry Settings
        </TabButton>
        <TabButton
          active={tab === 'previous'}
          onClick={() => setTab('previous')}
          icon={<History className="h-4 w-4" />}
        >
          Previous Marks
        </TabButton>
        <TabButton
          active={tab === 'import'}
          onClick={() => setTab('import')}
          icon={<Upload className="h-4 w-4" />}
        >
          Import / Export
        </TabButton>
      </div>

      {notice ? (
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {notice}
        </p>
      ) : null}

      {tab === 'students' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by roll number or student name..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              options={[
                ['all', 'All Students'],
                ['saved', 'Saved'],
                ['unsaved', 'Not Saved'],
                ['pending', 'Pending'],
              ]}
            />
            <FilterSelect
              label="Shift"
              value={shift}
              onChange={(value) => {
                setShift(value);
                setPage(1);
              }}
              options={[
                ['all', 'All Shifts'],
                ...shiftOptions.map((name) => [name, name] as [string, string]),
              ]}
            />
            <FilterSelect
              label="Sort By"
              value={sortBy}
              onChange={(value) => setSortBy(value as 'roll' | 'name')}
              options={[
                ['roll', 'Roll Number'],
                ['name', 'Student Name'],
              ]}
            />
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Show
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              students per page
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
              <GhostButton onClick={() => setPreviewOpen(true)} icon={<Eye className="h-4 w-4" />}>
                Preview
              </GhostButton>
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="h-4 w-4" /> Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onImportCsv(file);
                    event.target.value = '';
                  }}
                />
              </label>
              <GhostButton onClick={exportCsv} icon={<Download className="h-4 w-4" />}>
                Export CSV
              </GhostButton>
              <button
                type="button"
                onClick={() => {
                  const ids = Object.entries(selected)
                    .filter(([, on]) => on)
                    .map(([id]) => id);
                  save.mutate(ids.length ? ids : undefined);
                }}
                disabled={save.isPending || !dirtyCount || !schemeId}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Marks
              </button>
            </div>
          </div>

          {roster.isLoading ? (
            <p className="px-4 py-8 text-sm text-slate-500">Loading the student list…</p>
          ) : roster.isError ? (
            <div className="p-4">
              <QueryErrorPanel
                title="Unable to load this paper"
                error={roster.error}
                onRetry={() => void roster.refetch()}
                isRetrying={roster.isFetching}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-sky-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(event) => {
                          const on = event.target.checked;
                          setSelected((prev) => {
                            const next = { ...prev };
                            for (const student of pageRows) next[student.id] = on;
                            return next;
                          });
                        }}
                        aria-label="Select students on this page"
                      />
                    </th>
                    <th className="px-2 py-3 font-semibold">#</th>
                    <th className="px-2 py-3 font-semibold">Roll Number</th>
                    <th className="px-2 py-3 font-semibold">Student Name</th>
                    {components.map((cell) => (
                      <th key={cell.id} className="px-2 py-3 font-semibold">
                        {cell.label} ({Number(cell.maxMarks)})
                      </th>
                    ))}
                    <th className="px-2 py-3 font-semibold">Status</th>
                    <th className="px-2 py-3 font-semibold">Last Updated</th>
                    <th className="px-2 py-3 font-semibold">Remarks (Optional)</th>
                    <th className="px-2 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((student, index) => {
                    const status = rowStatus(student);
                    const updated = student.marks
                      .map((cell) => cell.updatedAt)
                      .filter(Boolean)
                      .sort()
                      .at(-1);
                    return (
                      <tr key={student.id} className="border-t border-slate-100">
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={Boolean(selected[student.id])}
                            onChange={(event) =>
                              setSelected((prev) => ({
                                ...prev,
                                [student.id]: event.target.checked,
                              }))
                            }
                            aria-label={`Select ${student.fullName || student.rollNumber}`}
                          />
                        </td>
                        <td className="px-2 py-2.5 text-slate-500">{pageStart + index}</td>
                        <td className="px-2 py-2.5 font-medium text-slate-800">
                          {student.rollNumber || '—'}
                        </td>
                        <td className="px-2 py-2.5 text-slate-800">{student.fullName || '—'}</td>
                        {student.marks.map((cell) => {
                          const key = `${student.id}:${cell.componentId}`;
                          const value = valueFor(student, cell);
                          const invalid = value != null && value > cell.maxMarks;
                          return (
                            <td key={cell.componentId} className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                max={cell.maxMarks}
                                value={value ?? ''}
                                onChange={(event) =>
                                  setDraftMarks((prev) => ({
                                    ...prev,
                                    [key]:
                                      event.target.value === '' ? null : Number(event.target.value),
                                  }))
                                }
                                className={cn(
                                  'h-9 w-20 rounded-lg border bg-white text-center text-sm outline-none',
                                  invalid
                                    ? 'border-rose-400'
                                    : 'border-slate-200 focus:border-blue-400',
                                )}
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-2.5">
                          <StatusPill status={status} />
                        </td>
                        <td className="px-2 py-2.5 text-xs text-slate-500">
                          {status === 'pending' ? '—' : formatUpdated(updated)}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={remarksFor(student)}
                            placeholder="Optional"
                            onChange={(event) =>
                              setDraftRemarks((prev) => ({
                                ...prev,
                                [student.id]: event.target.value,
                              }))
                            }
                            className="h-9 w-36 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blue-400"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <button
                            type="button"
                            title="Save this student"
                            disabled={!isDirty(student) || save.isPending}
                            onClick={() => save.mutate([student.id])}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!pageRows.length ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  No students match this paper and filter.
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {pageStart} to {pageEnd} of {visibleStudents.length} students
            </p>
            <div className="flex items-center gap-1">
              <PageButton disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </PageButton>
              {Array.from({ length: pageCount }, (_, index) => index + 1)
                .filter(
                  (item) => item === 1 || item === pageCount || Math.abs(item - safePage) <= 1,
                )
                .map((item, index, list) => (
                  <span key={item} className="flex items-center">
                    {index > 0 && list[index - 1] !== item - 1 ? (
                      <span className="px-1 text-slate-400">…</span>
                    ) : null}
                    <PageButton active={item === safePage} onClick={() => setPage(item)}>
                      {item}
                    </PageButton>
                  </span>
                ))}
              <PageButton disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </PageButton>
            </div>
            <div className="flex gap-2">
              <GhostButton
                onClick={() => {
                  setDraftMarks({});
                  setDraftRemarks({});
                  setNotice('Cleared unsaved marks on this paper.');
                }}
              >
                Clear All
              </GhostButton>
              <button
                type="button"
                onClick={() => save.mutate(undefined)}
                disabled={save.isPending || !dirtyCount || !schemeId}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Save All Marks
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Mark entry settings for this paper
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            These components were created with the examination. Marks are stored against this paper
            only.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Info label="Scheme" value={roster.data?.scheme?.name || 'Linked IA scheme'} />
            <Info label="Maximum marks" value={String(maxMarks || '—')} />
            <Info
              label="Pass mark"
              value={
                roster.data?.scheme?.passMark != null
                  ? String(roster.data.scheme.passMark)
                  : 'Not set'
              }
            />
          </dl>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Component</th>
                <th className="py-2">Code</th>
                <th className="py-2">Maximum</th>
              </tr>
            </thead>
            <tbody>
              {components.map((cell) => (
                <tr key={cell.id} className="border-t border-slate-100">
                  <td className="py-2">{cell.label}</td>
                  <td className="py-2">{cell.code}</td>
                  <td className="py-2">{Number(cell.maxMarks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!components.length ? (
            <p className="mt-3 text-sm text-slate-500">
              This paper does not have a mark component yet.
            </p>
          ) : null}
        </section>
      ) : null}

      {tab === 'previous' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Previous marks</h2>
          <p className="mt-1 text-sm text-slate-500">
            Earlier internal marks for the same subject, from other examinations.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Roll</th>
                  <th className="py-2">Student</th>
                  <th className="py-2">Examination</th>
                  <th className="py-2">Component</th>
                  <th className="py-2">Marks</th>
                </tr>
              </thead>
              <tbody>
                {(roster.data?.previousMarks ?? []).map((row, index) => {
                  const student = students.find((item) => item.id === row.studentId);
                  return (
                    <tr
                      key={`${row.studentId}-${row.paperCode}-${index}`}
                      className="border-t border-slate-100"
                    >
                      <td className="py-2">{student?.rollNumber || '—'}</td>
                      <td className="py-2">{student?.fullName || '—'}</td>
                      <td className="py-2">{row.examName}</td>
                      <td className="py-2">{row.componentLabel}</td>
                      <td className="py-2">
                        {row.marks ?? '—'}
                        {row.maxMarks != null ? ` / ${row.maxMarks}` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!roster.data?.previousMarks?.length ? (
              <p className="py-6 text-sm text-slate-500">
                No earlier marks are stored for this subject.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === 'import' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Import and export</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            CSV columns are roll number, component code, and marks. The first row is the heading.
            Component code for this paper: {components.map((cell) => cell.code).join(', ') || '—'}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
              <Upload className="h-4 w-4" /> Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onImportCsv(file);
                  event.target.value = '';
                }}
              />
            </label>
            <GhostButton onClick={exportCsv} icon={<Download className="h-4 w-4" />}>
              Export current list
            </GhostButton>
          </div>
        </section>
      ) : null}

      {helpOpen ? (
        <Modal title="How mark entry works" onClose={() => setHelpOpen(false)}>
          <ol className="list-decimal space-y-2 pl-4 text-sm text-slate-600">
            <li>Choose the examination, semester, department, and paper.</li>
            <li>
              The shift filter opens on that examination’s shift, so Day and Morning stay separate.
            </li>
            <li>Type the marks. A row stays Not Saved until you press Save.</li>
            <li>Save Marks stores the ticked rows, or every unsaved row when none are ticked.</li>
            <li>Save All Marks stores every unsaved row on this paper.</li>
          </ol>
        </Modal>
      ) : null}

      {previewOpen ? (
        <Modal title="Preview marks" onClose={() => setPreviewOpen(false)} wide>
          <p className="mb-3 text-sm text-slate-500">
            {selectedPaper?.paperCode} — {selectedPaper?.paperName}. {visibleStudents.length}{' '}
            students in the current filter.
          </p>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2">Roll</th>
                  <th className="py-2">Name</th>
                  {components.map((cell) => (
                    <th key={cell.id} className="py-2">
                      {cell.label}
                    </th>
                  ))}
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student) => (
                  <tr key={student.id} className="border-t border-slate-100">
                    <td className="py-1.5">{student.rollNumber}</td>
                    <td className="py-1.5">{student.fullName}</td>
                    {student.marks.map((cell) => (
                      <td key={cell.componentId} className="py-1.5">
                        {valueFor(student, cell) ?? '—'}
                      </td>
                    ))}
                    <td className="py-1.5">
                      <StatusPill status={rowStatus(student)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400';

function FilterCard({
  index,
  label,
  required,
  caption,
  children,
}: {
  index: number;
  label: string;
  required?: boolean;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
          {index}
        </span>
        <p className="text-xs font-medium text-slate-500">
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </p>
      </div>
      {children}
      {caption ? (
        <p className="mt-2 text-[11px] text-slate-400">{caption}</p>
      ) : (
        <p className="mt-2 h-4" />
      )}
    </div>
  );
}

function StatTile({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone: 'blue' | 'green' | 'amber';
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={cn('rounded-2xl px-4 py-3', tones[tone])}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="text-[11px] opacity-80">{hint}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium',
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function GhostButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {icon}
      {children}
    </button>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm',
        active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
        disabled && 'opacity-40',
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Saved
      </span>
    );
  }
  if (status === 'unsaved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock3 className="h-3.5 w-3.5" /> Not Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
      <AlertCircle className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className={cn(
          'max-h-[85vh] w-full overflow-auto rounded-2xl bg-white p-5 shadow-xl',
          wide ? 'max-w-4xl' : 'max-w-lg',
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
