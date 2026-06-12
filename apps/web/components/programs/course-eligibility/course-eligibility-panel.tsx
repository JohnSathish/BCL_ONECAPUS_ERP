'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchAcademicSubjects } from '@/services/academic-engine';
import {
  fetchCourseEligibility,
  fetchCourseEligibilityStats,
  fetchPrograms,
  updateCourseEligibility,
} from '@/services/programs';
import type {
  CourseEligibilityRules,
  EligibilityStreamCode,
  PriorStudyExclusion,
} from '@/types/course-eligibility';
import { ELIGIBILITY_STREAM_OPTIONS, EMPTY_ELIGIBILITY_RULES } from '@/types/course-eligibility';
import type { Course } from '@/types/programs';
import { EligibilityPreviewDialog } from './eligibility-preview-dialog';

type Props = {
  course: Course;
  canManage: boolean;
};

function toggleInList<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export function CourseEligibilityPanel({ course, canManage }: Props) {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<CourseEligibilityRules>(EMPTY_ELIGIBILITY_RULES);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const eligibilityQuery = useQuery({
    queryKey: ['course-eligibility', course.id],
    queryFn: () => fetchCourseEligibility(course.id),
  });

  const programsQuery = useQuery({
    queryKey: ['programs', 'eligibility-picker'],
    queryFn: () => fetchPrograms(1),
  });

  const subjectsQuery = useQuery({
    queryKey: ['academic-subjects'],
    queryFn: () => fetchAcademicSubjects(),
  });

  const statsQuery = useQuery({
    queryKey: ['course-eligibility-stats', course.id, rules],
    queryFn: () => fetchCourseEligibilityStats(course.id),
    enabled: Boolean(course.id),
  });

  useEffect(() => {
    if (eligibilityQuery.data) {
      setRules(eligibilityQuery.data);
      setDirty(false);
    }
  }, [eligibilityQuery.data]);

  const saveMut = useMutation({
    mutationFn: () => updateCourseEligibility(course.id, rules),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['course-eligibility', course.id] });
      queryClient.invalidateQueries({ queryKey: ['course-eligibility-stats', course.id] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const programOptions = useMemo(() => programsQuery.data?.data ?? [], [programsQuery.data]);

  const versionOptions = useMemo(
    () =>
      programOptions.flatMap((program) =>
        (program.versions ?? []).map((version) => ({
          id: version.id,
          label: `${program.code} v${version.version}`,
          programId: program.id,
        })),
      ),
    [programOptions],
  );

  const updateRules = (patch: Partial<CourseEligibilityRules>) => {
    setRules((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const toggleStream = (
    code: EligibilityStreamCode,
    field: 'allowedStreams' | 'excludedStreams',
  ) => {
    if (code === 'ALL' && field === 'allowedStreams') {
      updateRules({ allowedStreams: ['ALL'] });
      return;
    }
    const current = rules[field] ?? [];
    const withoutAll = field === 'allowedStreams' ? current.filter((s) => s !== 'ALL') : current;
    updateRules({ [field]: toggleInList(withoutAll as EligibilityStreamCode[], code) });
  };

  const addPriorStudyRule = () => {
    const next: PriorStudyExclusion[] = [
      ...(rules.priorStudyExclusions ?? []),
      { subjectSlug: '' },
    ];
    updateRules({ priorStudyExclusions: next });
  };

  const addClass12Rule = () => {
    updateRules({
      class12SubjectExclusions: [...(rules.class12SubjectExclusions ?? []), { subjectSlug: '' }],
    });
  };

  return (
    <div className="space-y-5">
      {statsQuery.data ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">Preview: </span>
          Eligible students: {statsQuery.data.eligible} · Blocked: {statsQuery.data.blocked}
        </div>
      ) : null}

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Allowed streams</h4>
        <p className="text-xs text-muted-foreground">
          Leave empty for no stream restriction. Pools stay broad; these rules refine visibility.
        </p>
        <div className="flex flex-wrap gap-3">
          {ELIGIBILITY_STREAM_OPTIONS.map((option) => (
            <label key={`allowed-${option.code}`} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(rules.allowedStreams ?? []).includes(option.code)}
                onChange={() => toggleStream(option.code, 'allowedStreams')}
                disabled={!canManage}
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Excluded streams</h4>
        <p className="text-xs text-muted-foreground">
          Students in these streams cannot take this course (e.g. Science blocked from MDC-115).
        </p>
        <div className="flex flex-wrap gap-3">
          {ELIGIBILITY_STREAM_OPTIONS.filter((option) => option.code !== 'ALL').map((option) => (
            <label key={`excluded-${option.code}`} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(rules.excludedStreams ?? []).includes(option.code)}
                onChange={() => toggleStream(option.code, 'excludedStreams')}
                disabled={!canManage}
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Allowed programmes (whitelist)</h4>
        <select
          multiple
          className="min-h-[88px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={rules.allowedProgramIds ?? []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
            updateRules({ allowedProgramIds: selected });
          }}
          disabled={!canManage}
        >
          {programOptions.map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} — {program.name}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Excluded programmes</h4>
        <select
          multiple
          className="min-h-[88px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={rules.excludedProgramIds ?? []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
            updateRules({ excludedProgramIds: selected });
          }}
          disabled={!canManage}
        >
          {programOptions.map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} — {program.name}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Allowed programme versions (optional)</h4>
        <select
          multiple
          className="min-h-[72px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={rules.allowedProgramVersionIds ?? []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
            updateRules({ allowedProgramVersionIds: selected });
          }}
          disabled={!canManage}
        >
          {versionOptions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Excluded programme versions (optional)</h4>
        <select
          multiple
          className="min-h-[72px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={rules.excludedProgramVersionIds ?? []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
            updateRules({ excludedProgramVersionIds: selected });
          }}
          disabled={!canManage}
        >
          {versionOptions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label}
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Allowed major subjects</h4>
        <select
          multiple
          className="min-h-[72px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={rules.allowedMajorSubjectSlugs ?? []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
            updateRules({ allowedMajorSubjectSlugs: selected });
          }}
          disabled={!canManage}
        >
          {(subjectsQuery.data ?? []).map((subject) => (
            <option key={subject.id} value={subject.slug}>
              {subject.name} ({subject.slug})
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Excluded major subjects</h4>
        <select
          multiple
          className="min-h-[72px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={rules.excludedMajorSubjectSlugs ?? []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
            updateRules({ excludedMajorSubjectSlugs: selected });
          }}
          disabled={!canManage}
        >
          {(subjectsQuery.data ?? []).map((subject) => (
            <option key={subject.id} value={subject.slug}>
              {subject.name} ({subject.slug})
            </option>
          ))}
        </select>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Class XII subject exclusions</h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addClass12Rule}
            disabled={!canManage}
          >
            Add rule
          </Button>
        </div>
        {(rules.class12SubjectExclusions ?? []).map((row, index) => (
          <div key={`c12-${index}`} className="flex gap-2">
            <select
              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={row.subjectSlug}
              onChange={(e) => {
                const subject = (subjectsQuery.data ?? []).find((s) => s.slug === e.target.value);
                const next = [...(rules.class12SubjectExclusions ?? [])];
                next[index] = {
                  subjectSlug: e.target.value,
                  label: subject?.name ?? row.label,
                };
                updateRules({ class12SubjectExclusions: next });
              }}
              disabled={!canManage}
            >
              <option value="">Select Class XII subject…</option>
              {(subjectsQuery.data ?? []).map((subject) => (
                <option key={subject.id} value={subject.slug}>
                  {subject.name} ({subject.slug})
                </option>
              ))}
            </select>
            <Input
              placeholder="Display label (optional)"
              value={row.label ?? ''}
              onChange={(e) => {
                const next = [...(rules.class12SubjectExclusions ?? [])];
                next[index] = { ...row, label: e.target.value };
                updateRules({ class12SubjectExclusions: next });
              }}
              disabled={!canManage}
            />
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Prior study exclusions</h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addPriorStudyRule}
            disabled={!canManage}
          >
            Add rule
          </Button>
        </div>
        {(rules.priorStudyExclusions ?? []).map((row, index) => (
          <div key={`prior-${index}`} className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Subject slug"
              value={row.subjectSlug}
              onChange={(e) => {
                const next = [...(rules.priorStudyExclusions ?? [])];
                next[index] = { ...row, subjectSlug: e.target.value };
                updateRules({ priorStudyExclusions: next });
              }}
              disabled={!canManage}
            />
            <Input
              type="number"
              min={1}
              placeholder="Semester (optional)"
              value={row.semesterSequence ?? ''}
              onChange={(e) => {
                const next = [...(rules.priorStudyExclusions ?? [])];
                next[index] = {
                  ...row,
                  semesterSequence: e.target.value ? Number(e.target.value) : undefined,
                };
                updateRules({ priorStudyExclusions: next });
              }}
              disabled={!canManage}
            />
            <Input
              placeholder="Category (optional)"
              value={row.category ?? ''}
              onChange={(e) => {
                const next = [...(rules.priorStudyExclusions ?? [])];
                next[index] = { ...row, category: e.target.value || undefined };
                updateRules({ priorStudyExclusions: next });
              }}
              disabled={!canManage}
            />
            <Input
              placeholder="Label (optional)"
              value={row.label ?? ''}
              onChange={(e) => {
                const next = [...(rules.priorStudyExclusions ?? [])];
                next[index] = { ...row, label: e.target.value };
                updateRules({ priorStudyExclusions: next });
              }}
              disabled={!canManage}
            />
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          disabled={!canManage || !dirty || saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? 'Saving…' : 'Save eligibility rules'}
        </Button>
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          Test eligibility
        </Button>
      </div>

      <EligibilityPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        courseId={course.id}
        courseCode={course.code}
      />
    </div>
  );
}
