'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardList,
  DoorOpen,
  Loader2,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  allocateExamRooms,
  archiveExamSession,
  assignExamInvigilator,
  calculateExamResults,
  createExamPaper,
  createExamSession,
  downloadExamExport,
  fetchExamDashboard,
  fetchExamMarkRoster,
  fetchExamPaperDetails,
  fetchExamPapers,
  fetchExamPrintData,
  fetchExamReport,
  fetchExamResults,
  fetchExamSessions,
  generateExamSeating,
  publishExamResults,
  saveExamMarks,
  updateExamPaper,
  updateExamSession,
  type ExamMarkPayload,
  type ExamPaper,
  type ExamSession,
} from '@/services/examinations';
import { fetchInfrastructureRooms } from '@/services/infrastructure';
import { fetchAllCourses } from '@/services/programs';
import { fetchStaff } from '@/services/staff';
import { cn } from '@/utils/cn';

type Tab =
  | 'dashboard'
  | 'sessions'
  | 'papers'
  | 'seating'
  | 'invigilators'
  | 'marks'
  | 'results'
  | 'reports';

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sessions', label: 'Exam Sessions' },
  { key: 'papers', label: 'Exam Timetable' },
  { key: 'seating', label: 'Room & Seating' },
  { key: 'invigilators', label: 'Invigilators' },
  { key: 'marks', label: 'Marks Entry' },
  { key: 'results', label: 'Results' },
  { key: 'reports', label: 'Reports' },
];

export function ExaminationManagementWorkspace() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sessionId, setSessionId] = useState('');
  const dashboard = useQuery({ queryKey: ['exams', 'dashboard'], queryFn: fetchExamDashboard });
  const sessions = useQuery({
    queryKey: ['exams', 'sessions'],
    queryFn: () => fetchExamSessions(),
  });
  const activeSession = sessionId || sessions.data?.[0]?.id || '';

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Academic Operations
            </p>
            <h1 className="mt-1 text-2xl font-bold">Examination Management</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Exam sessions, paper timetable, infrastructure-aware room allocation, seating plans,
              invigilators, and reports.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-xs">
            <Kpi label="Sessions" value={dashboard.data?.sessions ?? 0} />
            <Kpi label="Papers" value={dashboard.data?.papers ?? 0} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-2">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                'shrink-0 rounded-xl px-3 py-2 text-xs font-medium',
                tab === item.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <select
          value={activeSession}
          onChange={(event) => setSessionId(event.target.value)}
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {(sessions.data ?? []).map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
      </div>

      {tab === 'dashboard' ? <DashboardPanel data={dashboard.data} /> : null}
      {tab === 'sessions' ? <SessionsPanel /> : null}
      {tab === 'papers' ? <PapersPanel sessionId={activeSession} /> : null}
      {tab === 'seating' ? <SeatingPanel sessionId={activeSession} /> : null}
      {tab === 'invigilators' ? <InvigilatorPanel sessionId={activeSession} /> : null}
      {tab === 'marks' ? <MarksEntryPanel sessionId={activeSession} /> : null}
      {tab === 'results' ? <ResultsPanel sessionId={activeSession} /> : null}
      {tab === 'reports' ? <ReportsPanel sessionId={activeSession} /> : null}
    </div>
  );
}

function DashboardPanel({ data }: { data: any }) {
  return (
    <div className="grid gap-3 md:grid-cols-6">
      <Metric icon={<CalendarDays />} label="Sessions" value={data?.sessions ?? 0} />
      <Metric icon={<ClipboardList />} label="Scheduled Papers" value={data?.papers ?? 0} />
      <Metric icon={<DoorOpen />} label="Room Allocations" value={data?.roomAllocations ?? 0} />
      <Metric icon={<Users />} label="Seats Generated" value={data?.seats ?? 0} />
      <Metric icon={<ShieldCheck />} label="Invigilators" value={data?.invigilators ?? 0} />
      <Metric icon={<ClipboardList />} label="Published Results" value={data?.results ?? 0} />
    </div>
  );
}

function SessionsPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<ExamSession>>({
    name: '',
    examType: 'SEMESTER_END',
    status: 'DRAFT',
  });
  const sessions = useQuery({
    queryKey: ['exams', 'sessions'],
    queryFn: () => fetchExamSessions(),
  });
  const save = useMutation({
    mutationFn: (payload: Partial<ExamSession>) =>
      payload.id ? updateExamSession(payload.id, payload) : createExamSession(payload),
    onSuccess: () => {
      setForm({ name: '', examType: 'SEMESTER_END', status: 'DRAFT' });
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: showApiError,
  });
  const archive = useMutation({
    mutationFn: archiveExamSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
    onError: showApiError,
  });
  return (
    <Panel
      title="Exam Sessions"
      subtitle="Create semester/end-term exam windows and publish them when ready."
    >
      <div className="grid gap-2 md:grid-cols-6">
        <Input
          label="Name"
          value={form.name ?? ''}
          onChange={(name) => setForm((prev) => ({ ...prev, name }))}
        />
        <Input
          label="Type"
          value={form.examType ?? ''}
          onChange={(examType) => setForm((prev) => ({ ...prev, examType }))}
        />
        <Input
          label="Semester"
          type="number"
          value={form.semesterNo ?? ''}
          onChange={(semesterNo) =>
            setForm((prev) => ({ ...prev, semesterNo: Number(semesterNo) || undefined }))
          }
        />
        <Input
          label="Start Date"
          value={dateValue(form.startDate)}
          onChange={(startDate) => setForm((prev) => ({ ...prev, startDate }))}
        />
        <Input
          label="End Date"
          value={dateValue(form.endDate)}
          onChange={(endDate) => setForm((prev) => ({ ...prev, endDate }))}
        />
        <Button
          className="mt-5"
          disabled={save.isPending || !form.name}
          onClick={() => save.mutate(form)}
        >
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {form.id ? 'Update' : 'Create'}
        </Button>
      </div>
      <DataTable
        rows={sessions.data ?? []}
        columns={['name', 'examType', 'semesterNo', 'status']}
        actions={(row: ExamSession) => (
          <>
            <Button size="sm" variant="outline" onClick={() => setForm(row)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => archive.mutate(row.id)}
            >
              Archive
            </Button>
          </>
        )}
      />
    </Panel>
  );
}

function PapersPanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<ExamPaper>>({
    sessionId,
    paperCode: '',
    paperName: '',
    examDate: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '12:00',
    expectedCount: 0,
    status: 'SCHEDULED',
  });
  const papers = useQuery({
    queryKey: ['exams', 'papers', sessionId],
    queryFn: () => fetchExamPapers({ sessionId: sessionId || undefined }),
  });
  const courses = useQuery({
    queryKey: ['programs', 'courses', 'exam-picker'],
    queryFn: () => fetchAllCourses({}),
  });
  const save = useMutation({
    mutationFn: (payload: Partial<ExamPaper>) =>
      payload.id
        ? updateExamPaper(payload.id, payload)
        : createExamPaper({ ...payload, sessionId }),
    onSuccess: () => {
      setForm({
        sessionId,
        paperCode: '',
        paperName: '',
        examDate: new Date().toISOString().slice(0, 10),
        startTime: '09:00',
        endTime: '12:00',
        expectedCount: 0,
        status: 'SCHEDULED',
      });
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: showApiError,
  });
  return (
    <Panel
      title="Exam Timetable"
      subtitle="Schedule papers with date, time, expected count, and optional course mapping."
    >
      <div className="grid gap-2 md:grid-cols-7">
        <select
          value={form.courseId ?? ''}
          onChange={(event) => {
            const course = courses.data?.data.find((item) => item.id === event.target.value);
            setForm((prev) => ({
              ...prev,
              courseId: event.target.value || undefined,
              paperCode: course?.code ?? prev.paperCode,
              paperName: course?.title ?? prev.paperName,
            }));
          }}
          className="mt-5 h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Select course</option>
          {(courses.data?.data ?? []).map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} - {course.title}
            </option>
          ))}
        </select>
        <Input
          label="Paper Code"
          value={form.paperCode ?? ''}
          onChange={(paperCode) => setForm((prev) => ({ ...prev, paperCode }))}
        />
        <Input
          label="Paper Name"
          value={form.paperName ?? ''}
          onChange={(paperName) => setForm((prev) => ({ ...prev, paperName }))}
        />
        <Input
          label="Exam Date"
          value={dateValue(form.examDate)}
          onChange={(examDate) => setForm((prev) => ({ ...prev, examDate }))}
        />
        <Input
          label="Start"
          value={timeValue(form.startTime)}
          onChange={(startTime) => setForm((prev) => ({ ...prev, startTime }))}
        />
        <Input
          label="End"
          value={timeValue(form.endTime)}
          onChange={(endTime) => setForm((prev) => ({ ...prev, endTime }))}
        />
        <Input
          label="Expected"
          type="number"
          value={form.expectedCount ?? 0}
          onChange={(expectedCount) =>
            setForm((prev) => ({ ...prev, expectedCount: Number(expectedCount) || 0 }))
          }
        />
      </div>
      <Button
        className="mt-3"
        disabled={save.isPending || !sessionId || !form.paperCode || !form.paperName}
        onClick={() => save.mutate(form)}
      >
        {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {form.id ? 'Update Paper' : 'Add Paper'}
      </Button>
      <DataTable
        rows={papers.data ?? []}
        columns={[
          'paperCode',
          'paperName',
          'examDate',
          'startTime',
          'endTime',
          'expectedCount',
          'status',
        ]}
        actions={(row: ExamPaper) => (
          <Button size="sm" variant="outline" onClick={() => setForm(row)}>
            Edit
          </Button>
        )}
      />
    </Panel>
  );
}

function SeatingPanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const [paperId, setPaperId] = useState('');
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const papers = useQuery({
    queryKey: ['exams', 'papers', sessionId],
    queryFn: () => fetchExamPapers({ sessionId: sessionId || undefined }),
  });
  const rooms = useQuery({
    queryKey: ['infrastructure', 'exam-rooms'],
    queryFn: () => fetchInfrastructureRooms({ status: 'ACTIVE' }),
  });
  const details = useQuery({
    queryKey: ['exams', 'paper-details', paperId],
    queryFn: () => fetchExamPaperDetails(paperId),
    enabled: Boolean(paperId),
  });
  const allocate = useMutation({
    mutationFn: () => allocateExamRooms(paperId, { roomIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: showApiError,
  });
  const seating = useMutation({
    mutationFn: () => generateExamSeating(paperId, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
    onError: showApiError,
  });
  return (
    <Panel
      title="Room Allocation & Seating"
      subtitle="Allocate infrastructure rooms by exam capacity and generate seat numbers."
    >
      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3">
          <select
            value={paperId}
            onChange={(event) => setPaperId(event.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="">Select exam paper</option>
            {(papers.data ?? []).map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.paperCode} - {paper.paperName}
              </option>
            ))}
          </select>
          <div className="max-h-80 space-y-1 overflow-auto rounded-2xl border border-border/60 p-2">
            {(rooms.data ?? []).map((room) => (
              <label
                key={room.id}
                className="flex items-center gap-2 rounded-xl px-2 py-1 text-xs hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={roomIds.includes(room.id)}
                  onChange={(event) =>
                    setRoomIds((prev) =>
                      event.target.checked
                        ? [...prev, room.id]
                        : prev.filter((id) => id !== room.id),
                    )
                  }
                />
                {room.code} · {room.name} · Exam cap {room.examCapacity ?? room.capacity}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button disabled={!paperId || allocate.isPending} onClick={() => allocate.mutate()}>
              Allocate Rooms
            </Button>
            <Button
              variant="outline"
              disabled={!paperId || seating.isPending}
              onClick={() => seating.mutate()}
            >
              Generate Seating
            </Button>
          </div>
        </div>
        <pre className="max-h-96 overflow-auto rounded-2xl bg-muted/40 p-3 text-xs">
          {JSON.stringify(details.data ?? {}, null, 2)}
        </pre>
      </div>
    </Panel>
  );
}

function InvigilatorPanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const [paperId, setPaperId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [staffProfileId, setStaffProfileId] = useState('');
  const papers = useQuery({
    queryKey: ['exams', 'papers', sessionId],
    queryFn: () => fetchExamPapers({ sessionId: sessionId || undefined }),
  });
  const details = useQuery({
    queryKey: ['exams', 'paper-details', paperId],
    queryFn: () => fetchExamPaperDetails(paperId),
    enabled: Boolean(paperId),
  });
  const staff = useQuery({
    queryKey: ['staff', 'exam-invigilators'],
    queryFn: () => fetchStaff({ limit: 100 }),
  });
  const assign = useMutation({
    mutationFn: () =>
      assignExamInvigilator(paperId, { classroomId, staffProfileId, role: 'INVIGILATOR' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams'] }),
    onError: showApiError,
  });
  const allocations = details.data?.rooms ?? [];
  return (
    <Panel title="Invigilator Assignment" subtitle="Assign faculty/staff to allocated exam rooms.">
      <div className="grid gap-2 md:grid-cols-4">
        <select
          value={paperId}
          onChange={(event) => setPaperId(event.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Select paper</option>
          {(papers.data ?? []).map((paper) => (
            <option key={paper.id} value={paper.id}>
              {paper.paperCode} - {paper.paperName}
            </option>
          ))}
        </select>
        <select
          value={classroomId}
          onChange={(event) => setClassroomId(event.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Select allocated room</option>
          {allocations.map((row: any) => (
            <option key={row.id} value={row.classroomId}>
              {row.metadata?.roomCode ?? row.classroomId}
            </option>
          ))}
        </select>
        <select
          value={staffProfileId}
          onChange={(event) => setStaffProfileId(event.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Select staff</option>
          {(staff.data?.data ?? []).map((member: any) => (
            <option key={member.id} value={member.id}>
              {member.fullName ?? member.employeeCode}
            </option>
          ))}
        </select>
        <Button
          disabled={!paperId || !classroomId || !staffProfileId || assign.isPending}
          onClick={() => assign.mutate()}
        >
          Assign
        </Button>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-muted/40 p-3 text-xs">
        {JSON.stringify(details.data?.invigilators ?? [], null, 2)}
      </pre>
    </Panel>
  );
}

function MarksEntryPanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const [paperId, setPaperId] = useState('');
  const [entries, setEntries] = useState<Record<string, ExamMarkPayload>>({});
  const papers = useQuery({
    queryKey: ['exams', 'papers', sessionId],
    queryFn: () => fetchExamPapers({ sessionId: sessionId || undefined }),
  });
  const roster = useQuery({
    queryKey: ['exams', 'marks-roster', paperId],
    queryFn: () => fetchExamMarkRoster(paperId),
    enabled: Boolean(paperId),
  });
  const save = useMutation({
    mutationFn: () => saveExamMarks(paperId, Object.values(entries)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      window.alert('Marks saved successfully.');
    },
    onError: showApiError,
  });

  useEffect(() => {
    const next: Record<string, ExamMarkPayload> = {};
    for (const row of roster.data?.rows ?? []) {
      next[row.student.id] = {
        studentId: row.student.id,
        internalMarks: numberOrUndefined(row.mark?.internalMarks),
        externalMarks: numberOrUndefined(row.mark?.externalMarks),
        practicalMarks: numberOrUndefined(row.mark?.practicalMarks),
        graceMarks: numberOrUndefined(row.mark?.graceMarks),
        maxMarks: numberOrUndefined(row.mark?.maxMarks) ?? 100,
        resultStatus: row.mark?.resultStatus,
        entryStatus: row.mark?.entryStatus ?? 'DRAFT',
        remarks: row.mark?.remarks ?? '',
      };
    }
    setEntries(next);
  }, [roster.data]);

  const update = (studentId: string, patch: Partial<ExamMarkPayload>) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? { studentId, maxMarks: 100, entryStatus: 'DRAFT' }),
        ...patch,
      },
    }));
  };

  return (
    <Panel
      title="Marks Entry"
      subtitle="Enter internal, external, practical, grace marks, and result status for each student."
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={paperId}
          onChange={(event) => setPaperId(event.target.value)}
          className="h-10 min-w-80 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Select exam paper</option>
          {(papers.data ?? []).map((paper) => (
            <option key={paper.id} value={paper.id}>
              {paper.paperCode} - {paper.paperName}
            </option>
          ))}
        </select>
        <Button
          disabled={!paperId || save.isPending || !Object.keys(entries).length}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Marks
        </Button>
      </div>

      <div className="mt-4 overflow-auto rounded-2xl border border-border/60">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Roll/Seat</th>
              <th className="px-3 py-2">Internal</th>
              <th className="px-3 py-2">External</th>
              <th className="px-3 py-2">Practical</th>
              <th className="px-3 py-2">Grace</th>
              <th className="px-3 py-2">Max</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(roster.data?.rows ?? []).map((row: any) => {
              const entry = entries[row.student.id] ?? { studentId: row.student.id };
              return (
                <tr key={row.student.id} className="border-t border-border/60">
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {row.student.masterProfile?.fullName ??
                        row.student.user?.displayName ??
                        'Student'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.student.admissionNumber ?? row.student.enrollmentNumber}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {row.student.rollNumber ?? '—'} / {row.seat?.seatNumber ?? '—'}
                  </td>
                  {(
                    [
                      'internalMarks',
                      'externalMarks',
                      'practicalMarks',
                      'graceMarks',
                      'maxMarks',
                    ] as const
                  ).map((field) => (
                    <td key={field} className="px-3 py-2">
                      <input
                        type="number"
                        value={entry[field] ?? ''}
                        onChange={(event) =>
                          update(row.student.id, {
                            [field]: Number(event.target.value) || undefined,
                          })
                        }
                        className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <select
                      value={entry.resultStatus ?? ''}
                      onChange={(event) =>
                        update(row.student.id, { resultStatus: event.target.value || undefined })
                      }
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                    >
                      <option value="">Auto</option>
                      <option value="PASS">Pass</option>
                      <option value="FAIL">Fail</option>
                      <option value="ABSENT">Absent</option>
                      <option value="MALPRACTICE">Malpractice</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {paperId && !roster.data?.rows?.length ? (
          <p className="p-4 text-sm text-muted-foreground">
            No registered/seated students found for this paper.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function ResultsPanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const report = useQuery({
    queryKey: ['exams', 'results', sessionId],
    queryFn: () => fetchExamResults({ sessionId: sessionId || undefined }),
  });
  const calculate = useMutation({
    mutationFn: () => calculateExamResults(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      window.alert('Results calculated successfully.');
    },
    onError: showApiError,
  });
  const publish = useMutation({
    mutationFn: () => publishExamResults(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      window.alert('Results published to student portal.');
    },
    onError: showApiError,
  });
  const rows = (report.data?.rows ?? []).map((row: any) => ({
    id: row.id,
    student:
      row.student?.masterProfile?.fullName ?? row.student?.user?.displayName ?? row.studentId,
    totalMarks: row.totalMarks,
    maxMarks: row.maxMarks,
    percentage: row.percentage,
    sgpa: row.sgpa,
    resultStatus: row.resultStatus,
    publishStatus: row.publishStatus,
  }));
  return (
    <Panel
      title="Result Processing"
      subtitle="Calculate semester result summaries and publish them to the student portal."
    >
      <div className="flex flex-wrap gap-2">
        <Button disabled={!sessionId || calculate.isPending} onClick={() => calculate.mutate()}>
          {calculate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Calculate Results
        </Button>
        <Button
          variant="outline"
          disabled={!sessionId || publish.isPending || !rows.length}
          onClick={() => publish.mutate()}
        >
          Publish Results
        </Button>
      </div>
      <DataTable
        rows={rows}
        columns={[
          'student',
          'totalMarks',
          'maxMarks',
          'percentage',
          'sgpa',
          'resultStatus',
          'publishStatus',
        ]}
      />
    </Panel>
  );
}

function ReportsPanel({ sessionId }: { sessionId: string }) {
  const [type, setType] = useState('papers');
  const report = useQuery({
    queryKey: ['exams', 'report', type, sessionId],
    queryFn: () => fetchExamReport(type, { sessionId: sessionId || undefined }),
  });
  const print = useQuery({
    queryKey: ['exams', 'print', type, sessionId],
    queryFn: () =>
      fetchExamPrintData(type === 'papers' ? 'timetable' : type, {
        sessionId: sessionId || undefined,
      }),
  });
  const exportCsv = async () => {
    const exportType = type === 'papers' ? 'timetable' : type;
    const blob = await downloadExamExport(exportType, { sessionId: sessionId || undefined });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-${exportType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Panel
      title="Examination Reports"
      subtitle="Room allocation, seating, invigilation, and exam timetable reports."
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="papers">Exam Timetable</option>
          <option value="rooms">Room Allocation</option>
          <option value="seating">Seating Plan</option>
          <option value="invigilators">Invigilator Duty</option>
        </select>
        <Button variant="outline" onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <PrintableExamReport type={type} data={print.data} fallback={report.data ?? []} />
    </Panel>
  );
}

function PrintableExamReport({
  type,
  data,
  fallback,
}: {
  type: string;
  data: any;
  fallback: any[];
}) {
  if (type === 'seating') {
    const rooms = data?.rooms ?? [];
    const seats = data?.seats ?? fallback;
    return (
      <div className="mt-4 space-y-4 rounded-2xl border border-border/60 bg-background p-4 print:border-0">
        <ReportHeader title="Room-wise Seating Plan" session={data?.session} />
        {rooms.map((room: any) => {
          const roomSeats = seats.filter((seat: any) => seat.classroomId === room.id);
          return (
            <div
              key={room.id}
              className="break-inside-avoid rounded-2xl border border-border/60 p-3"
            >
              <h3 className="font-semibold">
                {room.code} · {room.name}
              </h3>
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                {roomSeats.map((seat: any) => (
                  <div key={seat.id} className="rounded-xl border border-border/60 p-2 text-xs">
                    <p className="font-semibold">{seat.seatNumber}</p>
                    <p>{seat.rollNumber ?? 'Roll pending'}</p>
                    <p className="text-muted-foreground">
                      {seat.metadata?.studentName ?? 'Student name pending'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!rooms.length ? (
          <DataTable rows={seats} columns={['seatNumber', 'rollNumber', 'classroomId', 'status']} />
        ) : null}
      </div>
    );
  }
  if (type === 'invigilators') {
    const staff = data?.staff ?? [];
    const rooms = data?.rooms ?? [];
    const invigilators = data?.invigilators ?? fallback;
    return (
      <div className="mt-4 rounded-2xl border border-border/60 bg-background p-4 print:border-0">
        <ReportHeader title="Invigilator Duty Chart" session={data?.session} />
        <DataTable
          rows={invigilators.map((row: any) => ({
            ...row,
            staff:
              staff.find((member: any) => member.id === row.staffProfileId)?.fullName ??
              row.staffProfileId,
            room: rooms.find((room: any) => room.id === row.classroomId)?.code ?? row.classroomId,
          }))}
          columns={['staff', 'role', 'room', 'status']}
        />
      </div>
    );
  }
  const papers = data?.papers ?? fallback;
  return (
    <div className="mt-4 rounded-2xl border border-border/60 bg-background p-4 print:border-0">
      <ReportHeader title="Examination Timetable" session={data?.session} />
      <DataTable
        rows={papers}
        columns={[
          'paperCode',
          'paperName',
          'examDate',
          'startTime',
          'endTime',
          'expectedCount',
          'status',
        ]}
      />
    </div>
  );
}

function ReportHeader({ title, session }: { title: string; session?: ExamSession | null }) {
  return (
    <div className="mb-3 border-b border-border/60 pb-3 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">BCL OneCampus ERP</p>
      <h2 className="text-xl font-bold">{title}</h2>
      {session ? (
        <p className="text-sm text-muted-foreground">
          {session.name} · {session.examType}
        </p>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function DataTable({
  rows,
  columns,
  actions,
}: {
  rows: any[];
  columns: string[];
  actions?: (row: any) => React.ReactNode;
}) {
  return (
    <div className="mt-4 overflow-auto rounded-2xl border border-border/60">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2">
                {column}
              </th>
            ))}
            {actions ? <th className="px-3 py-2 text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border/60">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2">
                  {formatCell(row[column])}
                </td>
              ))}
              {actions ? (
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">{actions(row)}</div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="p-4 text-sm text-muted-foreground">No records found.</p> : null}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs font-medium">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
      />
    </label>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-background/70 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        {icon ? <span className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</span> : null}
      </div>
    </div>
  );
}

function dateValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : '';
}

function timeValue(value?: string | null) {
  if (!value) return '';
  if (/^\d{2}:\d{2}/.test(String(value))) return String(value).slice(0, 5);
  return new Date(value).toISOString().slice(11, 16);
}

function formatCell(value: unknown) {
  if (value == null) return '—';
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string' && value.includes('T')) return value.slice(0, 10);
  return String(value);
}

function numberOrUndefined(value: unknown) {
  if (value == null || value === '') return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function showApiError(error: unknown) {
  const anyError = error as any;
  const response = anyError?.response?.data;
  const message =
    typeof response?.message === 'string'
      ? response.message
      : (response?.message?.message ?? anyError?.message ?? 'Action failed');
  window.alert(message);
}
