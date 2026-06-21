'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createIaExam, fetchIaExams, type IaExamSummary } from '@/services/examinations-ia';
import { fetchAcademicDepartments } from '@/services/organization';
import { fetchProgramVersions, fetchPrograms } from '@/services/programs';
import { apiErrorMessage } from '@/utils/api-error';

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

export function IaExamsWorkspace() {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');

  const [name, setName] = useState('IA Test 1');
  const [semesterNo, setSemesterNo] = useState(3);
  const [programId, setProgramId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [examType, setExamType] = useState('IA_TEST_1');
  const [maxMarks, setMaxMarks] = useState(20);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const exams = useQuery({ queryKey: ['ia', 'exams'], queryFn: fetchIaExams });
  const programs = useQuery({
    queryKey: ['programs', 'ia-exams'],
    queryFn: () => fetchPrograms(1, ''),
  });
  const departments = useQuery({
    queryKey: ['departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
  });
  const versions = useQuery({
    queryKey: ['program-versions', programId],
    queryFn: () => fetchProgramVersions(programId),
    enabled: Boolean(programId),
  });

  const programVersionId = useMemo(() => {
    const rows = versions.data ?? [];
    return rows.find((v) => v.status === 'PUBLISHED')?.id ?? rows[0]?.id ?? '';
  }, [versions.data]);

  const selectedProgram = (programs.data?.data ?? []).find((p) => p.id === programId);

  const create = useMutation({
    mutationFn: () =>
      createIaExam({
        name,
        semesterNo,
        programVersionId,
        departmentId: departmentId || undefined,
        examType,
        maxMarks,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        remarks: remarks || undefined,
      }),
    onSuccess: (result) => {
      setMessage(
        `Exam created. ${result.summary.subjectsLoaded} subjects and ${result.summary.studentsRegistered} student registrations loaded automatically.`,
      );
      qc.invalidateQueries({ queryKey: ['ia'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create IA exam')),
  });

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <Card
        title="Create IA Exam"
        description="Students and subjects are loaded automatically from semester registration and curriculum mapping. No manual scheme or registration required."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Exam name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="IA Test 1" />
          </div>
          <div className="space-y-1.5">
            <Label>Semester</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={semesterNo}
              onChange={(e) => setSemesterNo(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Programme</Label>
            <select
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              <option value="">Select programme…</option>
              {(programs.data?.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Department (optional filter)</Label>
            <select
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">All departments</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Exam type</Label>
            <select
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            >
              {[
                ['IA_TEST_1', 'Internal Assessment — Test 1'],
                ['IA_TEST_2', 'Internal Assessment — Test 2'],
                ['IA_TEST_3', 'Internal Assessment — Test 3'],
                ['IA_ASSIGNMENT', 'Assignment'],
                ['IA_PRACTICAL', 'Practical'],
                ['IA_VIVA', 'Viva'],
              ].map(([value, label]) => (
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
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Remarks</Label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional instructions for exam cell"
            />
          </div>
        </div>

        {selectedProgram && programVersionId ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Using programme version for <strong>{selectedProgram.name}</strong>. Subjects will be
            pulled from Semester {semesterNo} curriculum automatically.
          </p>
        ) : null}

        <Button
          className="mt-4"
          size="sm"
          disabled={!name.trim() || !programVersionId || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus className="mr-1 h-4 w-4" />
          {create.isPending ? 'Creating…' : 'Create IA Exam'}
        </Button>
      </Card>

      <Card title="IA Exams">
        <ul className="divide-y text-sm">
          {(exams.data ?? []).map((exam: IaExamSummary) => (
            <li key={exam.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{exam.name}</p>
                <p className="text-xs text-muted-foreground">
                  {exam.examType.replace(/_/g, ' ')} · Sem {exam.semesterNo ?? '—'}
                  {exam.metadata?.programmeName ? ` · ${exam.metadata.programmeName}` : ''}
                </p>
                {exam.stats ? (
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{exam.stats.subjectsScheduled} subjects</span>
                    <span>·</span>
                    <span>{exam.stats.expectedRegistrations} registrations</span>
                  </p>
                ) : null}
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{exam.status}</span>
            </li>
          ))}
          {!exams.data?.length && !exams.isLoading ? (
            <li className="py-6 text-center text-xs text-muted-foreground">
              No IA exams yet. Create one above — students and subjects load automatically.
            </li>
          ) : null}
        </ul>
      </Card>

      <Card
        title="What happens automatically"
        description="Exam Cell staff do not need to configure schemes, components, or student lists."
      >
        <ul className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            All curriculum subjects for the semester are scheduled
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Registered students appear in mark entry per subject
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Mark scheme is created per subject (hidden in Settings)
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Continue to IA Timetable → Admit Cards → Mark Entry
          </li>
        </ul>
      </Card>
    </div>
  );
}
