'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchQuestionBankPeople, updateQuestionPaper } from '@/services/question-bank';
import type { QuestionPaper } from '@/types/question-bank';
import { apiErrorMessage } from '@/utils/api-error';

const LANGUAGES = ['EN', 'HI', 'GARO', 'KHASI', 'BILINGUAL'];
const PAPER_TYPES = ['THEORY', 'THEORY_PRACTICAL', 'PRACTICAL'];
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

type Props = {
  paper: QuestionPaper;
  onClose: () => void;
  onSaved: () => void;
};

export function EditMetadataDialog({ paper, onClose, onSaved }: Props) {
  const queryEnabled = useAuthQueryEnabled();
  const [form, setForm] = useState({
    examinationType: paper.examinationType ?? '',
    examCycle: paper.examCycle ?? '',
    subjectCategory: paper.subjectCategory ?? '',
    language: paper.language ?? 'EN',
    universityName: paper.universityName ?? '',
    paperType: paper.paperType ?? 'THEORY',
    examMonth: paper.examMonth != null ? String(paper.examMonth) : '',
    examYear: paper.examYear != null ? String(paper.examYear) : '',
    semesterNo: paper.semesterNo != null ? String(paper.semesterNo) : '',
    maxMarks: paper.maxMarks != null ? String(paper.maxMarks) : '',
    durationMinutes: paper.durationMinutes != null ? String(paper.durationMinutes) : '',
    notes: paper.notes ?? '',
    keywords: (paper.keywords ?? []).join(', '),
    verifiedById: paper.verifiedById ?? '',
  });
  const [peopleQ, setPeopleQ] = useState('');

  const peopleQuery = useQuery({
    queryKey: ['question-bank', 'people', peopleQ],
    queryFn: () => fetchQuestionBankPeople(peopleQ),
    enabled: queryEnabled,
  });

  useEffect(() => {
    setForm({
      examinationType: paper.examinationType ?? '',
      examCycle: paper.examCycle ?? '',
      subjectCategory: paper.subjectCategory ?? '',
      language: paper.language ?? 'EN',
      universityName: paper.universityName ?? '',
      paperType: paper.paperType ?? 'THEORY',
      examMonth: paper.examMonth != null ? String(paper.examMonth) : '',
      examYear: paper.examYear != null ? String(paper.examYear) : '',
      semesterNo: paper.semesterNo != null ? String(paper.semesterNo) : '',
      maxMarks: paper.maxMarks != null ? String(paper.maxMarks) : '',
      durationMinutes: paper.durationMinutes != null ? String(paper.durationMinutes) : '',
      notes: paper.notes ?? '',
      keywords: (paper.keywords ?? []).join(', '),
      verifiedById: paper.verifiedById ?? '',
    });
  }, [paper]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      const fields: Record<string, string> = {
        examinationType: form.examinationType,
        examCycle: form.examCycle,
        subjectCategory: form.subjectCategory,
        language: form.language,
        universityName: form.universityName,
        paperType: form.paperType,
        examMonth: form.examMonth,
        examYear: form.examYear,
        semesterNo: form.semesterNo,
        maxMarks: form.maxMarks,
        durationMinutes: form.durationMinutes,
        notes: form.notes,
      };
      Object.entries(fields).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      fd.append('verifiedById', form.verifiedById || '');
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
      } else {
        fd.append('keywords', JSON.stringify([]));
      }
      return updateQuestionPaper(paper.id, fd);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const patch = (partial: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...partial }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Pencil className="h-4 w-4" /> Edit metadata
            </h3>
            <p className="text-sm text-muted-foreground">
              {paper.paperCode} — {paper.paperName}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>Examination</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={form.examinationType}
              onChange={(e) => patch({ examinationType: e.target.value })}
            >
              <option value="">—</option>
              {EXAMINATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Exam cycle</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={form.examCycle}
              onChange={(e) => patch({ examCycle: e.target.value })}
            >
              <option value="">—</option>
              <option value="ODD">ODD</option>
              <option value="EVEN">EVEN</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Subject category</span>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={form.subjectCategory}
              onChange={(e) => patch({ subjectCategory: e.target.value })}
            >
              <option value="">—</option>
              {SUBJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Paper type</span>
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
            <span>Semester</span>
            <Input
              type="number"
              value={form.semesterNo}
              onChange={(e) => patch({ semesterNo: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Exam month</span>
            <Input
              type="number"
              min={1}
              max={12}
              value={form.examMonth}
              onChange={(e) => patch({ examMonth: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Exam year</span>
            <Input
              type="number"
              value={form.examYear}
              onChange={(e) => patch({ examYear: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Max marks</span>
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
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>Verified by</span>
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
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>Notes</span>
            <textarea
              className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>Tags / keywords</span>
            <Input
              value={form.keywords}
              onChange={(e) => patch({ keywords: e.target.value })}
              placeholder="comma-separated"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? 'Saving…' : 'Save metadata'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {saveMut.isError ? (
          <p className="mt-2 text-sm text-destructive">{apiErrorMessage(saveMut.error)}</p>
        ) : null}
      </div>
    </div>
  );
}
