'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileUp, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicYears, fetchAcademicDepartments } from '@/services/organization';
import { fetchAllPrograms } from '@/services/programs';
import {
  commitQuestionBankBulk,
  createQuestionPaper,
  downloadQuestionBankTemplate,
  fetchCurriculumCourses,
  fetchQuestionBankPeople,
  previewQuestionBankBulk,
} from '@/services/question-bank';
import { apiErrorMessage } from '@/utils/api-error';

const EXAMINATION_TYPES = [
  'UNIVERSITY_EXAM',
  'INTERNAL',
  'MID_SEM',
  'MODEL',
  'PRACTICAL',
  'SUPPLEMENTARY',
  'REVALUATION',
];
const SUBJECT_CATEGORIES = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC', 'VTC', 'PRACTICAL'];
const LANGUAGES = ['EN', 'HI', 'GARO', 'KHASI', 'BILINGUAL'];
const PAPER_TYPES = ['THEORY', 'THEORY_PRACTICAL', 'PRACTICAL'];

type WizardForm = {
  academicYearId: string;
  examinationType: string;
  semesterNo: string;
  examCycle: string;
  programId: string;
  programVersionId: string;
  departmentId: string;
  subjectCategory: string;
  courseId: string;
  paperCode: string;
  paperName: string;
  examMonth: string;
  examYear: string;
  paperType: string;
  maxMarks: string;
  durationMinutes: string;
  language: string;
  universityName: string;
  notes: string;
  keywords: string;
  verifiedById: string;
};

const emptyForm = (): WizardForm => ({
  academicYearId: '',
  examinationType: 'UNIVERSITY_EXAM',
  semesterNo: '',
  examCycle: '',
  programId: '',
  programVersionId: '',
  departmentId: '',
  subjectCategory: '',
  courseId: '',
  paperCode: '',
  paperName: '',
  examMonth: '',
  examYear: String(new Date().getFullYear()),
  paperType: 'THEORY',
  maxMarks: '',
  durationMinutes: '',
  language: 'EN',
  universityName: 'North Eastern Hill University (NEHU)',
  notes: '',
  keywords: '',
  verifiedById: '',
});

function cycleFromSemester(sem: string) {
  const n = Number(sem);
  if (!n) return '';
  return n % 2 === 1 ? 'ODD' : 'EVEN';
}

type Props = {
  canManage?: boolean;
  onDone: () => void;
};

export function QuestionPaperUploadWizard({ canManage, onDone }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const { session } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [peopleQ, setPeopleQ] = useState('');
  const [bulkExcel, setBulkExcel] = useState<File | null>(null);
  const [bulkZip, setBulkZip] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<Awaited<
    ReturnType<typeof previewQuestionBankBulk>
  > | null>(null);

  const yearsQuery = useQuery({
    queryKey: ['org', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: queryEnabled,
  });
  const deptsQuery = useQuery({
    queryKey: ['org', 'academic-departments'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: queryEnabled,
  });
  const programsQuery = useQuery({
    queryKey: ['programs', 'all'],
    queryFn: () => fetchAllPrograms(),
    enabled: queryEnabled,
  });

  const selectedProgram = useMemo(
    () => programsQuery.data?.data.find((p) => p.id === form.programId),
    [programsQuery.data, form.programId],
  );

  const coursesQuery = useQuery({
    queryKey: [
      'question-bank',
      'curriculum',
      form.departmentId,
      form.programVersionId,
      form.semesterNo,
      form.subjectCategory,
    ],
    queryFn: () =>
      fetchCurriculumCourses({
        departmentId: form.departmentId || undefined,
        programVersionId: form.programVersionId || undefined,
        semesterNo: form.semesterNo ? Number(form.semesterNo) : undefined,
        category: form.subjectCategory || undefined,
      }),
    enabled: queryEnabled && step >= 1,
  });

  const peopleQuery = useQuery({
    queryKey: ['question-bank', 'people', peopleQ],
    queryFn: () => fetchQuestionBankPeople(peopleQ),
    enabled: queryEnabled && step === 2,
  });

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const patch = (partial: Partial<WizardForm>) => setForm((prev) => ({ ...prev, ...partial }));

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('PDF is required');
      if (!form.courseId) throw new Error('Select a course from curriculum');
      const fd = new FormData();
      const fields: Record<string, string> = {
        paperCode: form.paperCode,
        paperName: form.paperName,
        academicYearId: form.academicYearId,
        programVersionId: form.programVersionId,
        departmentId: form.departmentId,
        courseId: form.courseId,
        semesterNo: form.semesterNo,
        examinationType: form.examinationType,
        examCycle: form.examCycle || cycleFromSemester(form.semesterNo),
        subjectCategory: form.subjectCategory,
        language: form.language,
        universityName: form.universityName,
        paperType: form.paperType,
        examMonth: form.examMonth,
        examYear: form.examYear,
        maxMarks: form.maxMarks,
        durationMinutes: form.durationMinutes,
        notes: form.notes,
        preparedById: session?.user?.id ?? '',
        verifiedById: form.verifiedById,
      };
      Object.entries(fields).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      if (form.keywords.trim()) {
        fd.append(
          'keywords',
          JSON.stringify(
            form.keywords
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean),
          ),
        );
      }
      fd.append('file', file);
      return createQuestionPaper(fd);
    },
    onSuccess: () => {
      setForm(emptyForm());
      setFile(null);
      setStep(0);
      onDone();
    },
  });

  const bulkPreviewMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      if (bulkExcel) fd.append('excel', bulkExcel);
      if (bulkZip) fd.append('zip', bulkZip);
      return previewQuestionBankBulk(fd);
    },
    onSuccess: setBulkPreview,
  });

  const bulkCommitMut = useMutation({
    mutationFn: async () => {
      const rows =
        bulkPreview?.rows.filter((r) => r.status === 'VALID').map((r) => r.normalized!) ?? [];
      return commitQuestionBankBulk(rows, bulkZip ?? undefined);
    },
    onSuccess: () => {
      setBulkPreview(null);
      setBulkExcel(null);
      setBulkZip(null);
      onDone();
    },
  });

  const steps = ['Academic', 'Course', 'Details', 'PDF', 'Notes'];

  const canNext = () => {
    if (step === 0) return Boolean(form.academicYearId && form.semesterNo && form.examinationType);
    if (step === 1) return Boolean(form.courseId && form.paperCode);
    if (step === 2) return Boolean(form.paperType && form.examYear);
    if (step === 3) return Boolean(file && file.type === 'application/pdf');
    return true;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Question Paper Repository</h2>
        <p className="text-sm text-muted-foreground">
          Upload with curriculum auto-fill. Paper code and title come from the selected course.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
            onClick={() => i < step && setStep(i)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border p-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Upload className="h-4 w-4" /> Upload wizard — {steps[step]}
          </h3>

          {step === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Academic Year *</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.academicYearId}
                  onChange={(e) => patch({ academicYearId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {(yearsQuery.data ?? []).map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Examination *</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.examinationType}
                  onChange={(e) => patch({ examinationType: e.target.value })}
                >
                  {EXAMINATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Semester *</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.semesterNo}
                  onChange={(e) =>
                    patch({
                      semesterNo: e.target.value,
                      examCycle: cycleFromSemester(e.target.value) || form.examCycle,
                    })
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Exam Cycle</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.examCycle || cycleFromSemester(form.semesterNo)}
                  onChange={(e) => patch({ examCycle: e.target.value })}
                >
                  <option value="ODD">ODD</option>
                  <option value="EVEN">EVEN</option>
                </select>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>Programme</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.programId}
                  onChange={(e) => {
                    const program = programsQuery.data?.data.find((p) => p.id === e.target.value);
                    const latest = program?.versions?.[0];
                    patch({
                      programId: e.target.value,
                      programVersionId: latest?.id ?? '',
                      departmentId: program?.departmentId ?? form.departmentId,
                    });
                  }}
                >
                  <option value="">Optional…</option>
                  {(programsQuery.data?.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedProgram?.versions?.length ? (
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span>Programme Version</span>
                  <select
                    className="w-full rounded-md border px-3 py-2"
                    value={form.programVersionId}
                    onChange={(e) => patch({ programVersionId: e.target.value })}
                  >
                    {selectedProgram.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({v.status})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>Department</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.departmentId}
                  onChange={(e) =>
                    patch({
                      departmentId: e.target.value,
                      courseId: '',
                      paperCode: '',
                      paperName: '',
                    })
                  }
                >
                  <option value="">Search / select…</option>
                  {(deptsQuery.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>Subject Category</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.subjectCategory}
                  onChange={(e) => patch({ subjectCategory: e.target.value })}
                >
                  <option value="">Any</option>
                  {SUBJECT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span>Course (curriculum) *</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.courseId}
                  onChange={(e) => {
                    const course = coursesQuery.data?.find((c) => c.id === e.target.value);
                    patch({
                      courseId: e.target.value,
                      paperCode: course?.code ?? '',
                      paperName: course?.title ?? '',
                      departmentId: course?.departmentId ?? form.departmentId,
                      subjectCategory: course?.category ?? form.subjectCategory,
                    });
                  }}
                >
                  <option value="">Select course…</option>
                  {(coursesQuery.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <Input readOnly value={form.paperCode} placeholder="Paper code (from course)" />
              <Input readOnly value={form.paperName} placeholder="Paper title (from course)" />
              {coursesQuery.isFetching ? (
                <p className="text-xs text-muted-foreground">Loading curriculum courses…</p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Exam Month</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.examMonth}
                  onChange={(e) => patch({ examMonth: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Exam Year *</span>
                <Input
                  type="number"
                  value={form.examYear}
                  onChange={(e) => patch({ examYear: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Paper Type *</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.paperType}
                  onChange={(e) => patch({ paperType: e.target.value })}
                >
                  {PAPER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Language</span>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.language}
                  onChange={(e) => patch({ language: e.target.value })}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span>Max Marks</span>
                <Input
                  type="number"
                  value={form.maxMarks}
                  onChange={(e) => patch({ maxMarks: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Duration (min)</span>
                <Input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => patch({ durationMinutes: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>University</span>
                <Input
                  value={form.universityName}
                  onChange={(e) => patch({ universityName: e.target.value })}
                />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Prepared by: {session?.user?.displayName || session?.user?.email || 'Current user'}
              </p>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>Verified by (optional)</span>
                <Input
                  placeholder="Search people…"
                  value={peopleQ}
                  onChange={(e) => setPeopleQ(e.target.value)}
                  className="mb-2"
                />
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={form.verifiedById}
                  onChange={(e) => patch({ verifiedById: e.target.value })}
                >
                  <option value="">None</option>
                  {(peopleQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.email ? ` (${p.email})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center hover:bg-muted/40">
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Drop PDF or click to browse</span>
                <span className="text-xs text-muted-foreground">PDF only · max 20 MB</span>
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file ? (
                <p className="text-sm">
                  Selected: <span className="font-medium">{file.name}</span> (
                  {(file.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              ) : null}
              {previewUrl ? (
                <iframe
                  title="PDF preview"
                  src={previewUrl}
                  className="h-72 w-full rounded-lg border"
                />
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span>Notes</span>
                <textarea
                  className="min-h-[100px] w-full rounded-md border px-3 py-2 text-sm"
                  value={form.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Tags / keywords (comma-separated)</span>
                <Input
                  value={form.keywords}
                  onChange={(e) => patch({ keywords: e.target.value })}
                  placeholder="organic, mid-sem, nehu"
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button
                disabled={uploadMut.isPending || !canNext()}
                onClick={() => uploadMut.mutate()}
              >
                {uploadMut.isPending ? 'Uploading…' : 'Submit paper'}
              </Button>
            )}
          </div>
          {uploadMut.isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(uploadMut.error)}</p>
          ) : null}
        </div>

        {canManage ? (
          <div className="space-y-4 rounded-xl border p-4">
            <h3 className="font-semibold">Bulk Import (Excel + ZIP of PDFs)</h3>
            <Button
              variant="outline"
              onClick={async () => {
                const blob = await downloadQuestionBankTemplate();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'question-bank-template.xlsx';
                a.click();
              }}
            >
              Download Template
            </Button>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setBulkExcel(e.target.files?.[0] ?? null)}
            />
            <Input
              type="file"
              accept=".zip"
              onChange={(e) => setBulkZip(e.target.files?.[0] ?? null)}
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!bulkExcel || bulkPreviewMut.isPending}
                onClick={() => bulkPreviewMut.mutate()}
              >
                Preview
              </Button>
              <Button
                disabled={!bulkPreview?.summary.valid || bulkCommitMut.isPending}
                onClick={() => bulkCommitMut.mutate()}
              >
                Commit {bulkPreview?.summary.valid ?? 0} rows
              </Button>
            </div>
            {bulkPreview ? (
              <p className="text-sm text-muted-foreground">
                {bulkPreview.summary.valid} valid / {bulkPreview.summary.invalid} invalid /{' '}
                {bulkPreview.zipFileCount} ZIP files
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Tip: choose department and semester first so the course list is narrowed to curriculum
            offerings. Matching identity uploads create a new version automatically.
          </div>
        )}
      </div>
    </div>
  );
}
