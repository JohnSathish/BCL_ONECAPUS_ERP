'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchAcademicStreams } from '@/services/academic-engine';
import {
  createIaExam,
  fetchIaExamDepartments,
  fetchIaExams,
  previewIaExam,
  type CreateIaExamPayload,
  type IaExamSummary,
} from '@/services/examinations-ia';
import { fetchAcademicYears } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const EXAM_TYPE_OPTIONS = [
  ['IA_TEST_1', 'IA Test 1'],
  ['IA_TEST_2', 'IA Test 2'],
  ['IA_TEST_3', 'IA Test 3'],
  ['IA_ASSIGNMENT', 'Assignment'],
  ['IA_SEMINAR', 'Seminar'],
  ['IA_PRESENTATION', 'Presentation'],
  ['IA_PROJECT_WORK', 'Project Work'],
  ['IA_PRACTICAL', 'Practical Assessment'],
  ['IA_VIVA', 'Viva'],
  ['IA_CIE', 'Continuous Internal Evaluation'],
] as const;

const WIZARD_STEPS = ['Exam details', 'Semesters', 'Stream', 'Departments', 'Summary'] as const;

const ODD_SEMESTERS = [1, 3, 5, 7];
const EVEN_SEMESTERS = [2, 4, 6, 8];

function Card({
  title,
  children,
  description,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StepPills({ step }: { step: number }) {
  return (
    <ol className="mb-4 flex flex-wrap gap-2">
      {WIZARD_STEPS.map((label, index) => (
        <li
          key={label}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium',
            index === step
              ? 'bg-primary text-primary-foreground'
              : index < step
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {index + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

function SemesterCheckbox({
  value,
  checked,
  onChange,
}: {
  value: number;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      Semester {value}
    </label>
  );
}

export function IaExamsWorkspace() {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [step, setStep] = useState(0);

  const [name, setName] = useState('IA Test 1');
  const [examType, setExamType] = useState('IA_TEST_1');
  const [maxMarks, setMaxMarks] = useState(20);
  const [remarks, setRemarks] = useState('');
  const [semesterNos, setSemesterNos] = useState<number[]>([1, 3, 5]);
  const [streamId, setStreamId] = useState('');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [allDepartments, setAllDepartments] = useState(true);

  const years = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears });
  const streams = useQuery({ queryKey: ['academic-streams'], queryFn: fetchAcademicStreams });
  const departments = useQuery({
    queryKey: ['ia', 'exam-departments', streamId || 'all'],
    queryFn: () => fetchIaExamDepartments(streamId || undefined),
  });
  const exams = useQuery({ queryKey: ['ia', 'exams'], queryFn: fetchIaExams });

  const activeYear = useMemo(
    () => years.data?.find((y) => y.status === 'ACTIVE') ?? years.data?.[0],
    [years.data],
  );

  useEffect(() => {
    if (allDepartments) setDepartmentIds([]);
  }, [allDepartments, streamId]);

  const payload = useMemo<CreateIaExamPayload>(
    () => ({
      name: name.trim(),
      semesterNos,
      streamId: streamId || undefined,
      departmentIds: allDepartments ? undefined : departmentIds,
      academicYearId: activeYear?.id,
      examType,
      maxMarks,
      remarks: remarks || undefined,
    }),
    [
      name,
      semesterNos,
      streamId,
      allDepartments,
      departmentIds,
      activeYear?.id,
      examType,
      maxMarks,
      remarks,
    ],
  );

  const preview = useQuery({
    queryKey: ['ia', 'exam-preview', payload],
    queryFn: () => previewIaExam(payload),
    enabled: step === 4 && semesterNos.length > 0 && Boolean(name.trim()),
  });

  const create = useMutation({
    mutationFn: () => createIaExam(payload),
    onSuccess: (result) => {
      setMessage(
        `Examination created. ${result.summary.studentsRegistered} students registered across ${result.summary.subjectsLoaded} subjects (Semesters ${result.summary.semesters.join(', ')}).`,
      );
      setStep(0);
      qc.invalidateQueries({ queryKey: ['ia'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create IA examination')),
  });

  const toggleSemester = (sem: number, on: boolean) => {
    setSemesterNos((prev) => {
      const next = new Set(prev);
      if (on) next.add(sem);
      else next.delete(sem);
      return [...next].sort((a, b) => a - b);
    });
  };

  const toggleDepartment = (id: string, on: boolean) => {
    setAllDepartments(false);
    setDepartmentIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return [...next];
    });
  };

  const canNext = () => {
    if (step === 0) return Boolean(name.trim()) && maxMarks > 0;
    if (step === 1) return semesterNos.length > 0;
    if (step === 2) return true;
    if (step === 3) return allDepartments || departmentIds.length > 0;
    return true;
  };

  const selectedStreamName =
    streamId === ''
      ? 'All Streams'
      : (streams.data?.find((s) => s.id === streamId)?.name ?? 'Selected stream');

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <Card
        title="Create IA Examination"
        description="Multi-semester wizard — students and subjects load automatically from semester registration and curriculum. No manual registration."
      >
        <StepPills step={step} />

        {step === 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Exam name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="IA Test 1, Mid Semester Assessment, Unit Test…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Academic year</Label>
              <Input readOnly value={activeYear?.name ?? 'Loading…'} className="bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Exam type</Label>
              <select
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
              >
                {EXAM_TYPE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Maximum marks</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value) || 20)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Remarks (optional)</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Instructions for exam cell"
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select all semesters running IA simultaneously (e.g. 1, 3, 5 for odd semesters).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSemesterNos([...ODD_SEMESTERS])}
              >
                Odd (1,3,5,7)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSemesterNos([...EVEN_SEMESTERS])}
              >
                Even (2,4,6,8)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSemesterNos([1, 2, 3, 4, 5, 6, 7, 8])}
              >
                All semesters
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                <SemesterCheckbox
                  key={sem}
                  value={sem}
                  checked={semesterNos.includes(sem)}
                  onChange={(on) => toggleSemester(sem, on)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="max-w-md space-y-2">
            <Label>Stream</Label>
            <select
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
            >
              <option value="">All Streams</option>
              {(streams.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {streamId
                ? `Only students and subjects under ${selectedStreamName} will be included.`
                : 'Arts, Science, and Commerce programmes will all be included.'}
            </p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={allDepartments}
                onChange={(e) => setAllDepartments(e.target.checked)}
              />
              All departments
              {streamId ? ` in ${selectedStreamName}` : ''}
            </label>
            {!allDepartments ? (
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
                {(departments.data ?? []).map((d) => (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={departmentIds.includes(d.id)}
                      onChange={(e) => toggleDepartment(d.id, e.target.checked)}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            {preview.isLoading ? (
              <p className="text-sm text-muted-foreground">Calculating preview…</p>
            ) : preview.data ? (
              <dl className="grid gap-2 rounded-xl border border-border bg-muted/20 p-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Exam name</dt>
                  <dd className="font-medium">{preview.data.examName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Academic year</dt>
                  <dd className="font-medium">{preview.data.academicYear}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Semesters</dt>
                  <dd className="font-medium">{preview.data.semesters.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stream</dt>
                  <dd className="font-medium">{preview.data.streamName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Departments</dt>
                  <dd className="font-medium">{preview.data.departmentCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Students</dt>
                  <dd className="font-medium">{preview.data.students.toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Subjects</dt>
                  <dd className="font-medium">{preview.data.subjects}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Maximum marks</dt>
                  <dd className="font-medium">{preview.data.maxMarks}</dd>
                </div>
              </dl>
            ) : null}
            {preview.data?.warnings?.length ? (
              <ul className="text-sm text-amber-700 dark:text-amber-400">
                {preview.data.warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {step > 0 ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : null}
          {step < 4 ? (
            <Button
              type="button"
              size="sm"
              disabled={!canNext()}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!preview.data?.ready || create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus className="mr-1 h-4 w-4" />
              {create.isPending ? 'Creating…' : 'Create Examination'}
            </Button>
          )}
        </div>
      </Card>

      <Card title="IA Examinations">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(exams.data ?? []).map((exam: IaExamSummary) => {
            const stats = exam.stats;
            const semesters =
              stats?.semesterNos?.join(', ') ?? (exam.semesterNo ? String(exam.semesterNo) : '—');
            return (
              <article
                key={exam.id}
                className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{exam.name}</h3>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">
                    {exam.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {exam.examType.replace(/_/g, ' ')} · {stats?.streamName ?? 'All Streams'}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Semesters</dt>
                  <dd>{semesters}</dd>
                  <dt className="text-muted-foreground">Departments</dt>
                  <dd>{stats?.departmentCount ?? '—'}</dd>
                  <dt className="text-muted-foreground">Registered</dt>
                  <dd>{stats?.registeredStudents?.toLocaleString() ?? '—'}</dd>
                  <dt className="text-muted-foreground">Subjects</dt>
                  <dd>{stats?.subjectsScheduled ?? '—'}</dd>
                  <dt className="text-muted-foreground">Marks entered</dt>
                  <dd>{stats ? `${stats.marksEntered}/${stats.expectedRegistrations}` : '—'}</dd>
                  <dt className="text-muted-foreground">Completion</dt>
                  <dd>{stats ? `${stats.completionPercent}%` : '—'}</dd>
                </dl>
              </article>
            );
          })}
        </div>
        {!exams.data?.length && !exams.isLoading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No IA examinations yet. Use the wizard above to create one.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
