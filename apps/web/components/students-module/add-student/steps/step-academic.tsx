'use client';

import { useEffect } from 'react';

import { ErpFormGrid, ErpFormSection } from '@/components/erp/erp-workspace-shell';
import { useAdmissionPools } from '@/components/students-module/add-student/hooks/use-admission-pools';
import {
  useEligibleMajors,
  useEligibleMinors,
} from '@/components/students-module/add-student/hooks/use-eligible-subjects';
import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
import type {
  BatchMeta,
  LookupOptions,
} from '@/components/students-module/add-student/types/lookups';
import { Class12AcademicBackgroundSection } from '@/components/students-module/add-student/ui/class12-academic-background-section';
import {
  GlassField,
  glassInputClass,
  glassSelectClass,
} from '@/components/students-module/add-student/ui/glass-field';
import { DateInput } from '@/components/ui/date-input';
import { SearchableDepartmentSelect } from '@/components/students-module/add-student/ui/searchable-department-select';
import { SearchableSubjectPathSelect } from '@/components/students-module/add-student/ui/searchable-subject-path-select';
import { resolveDepartmentIdForProgramVersion } from '@/components/students-module/add-student/utils/program-department-map';
import { minorRequired } from '@/utils/semester-rules';

type Props = {
  draft: AddStudentDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStudentDraft>>;
  lookups: LookupOptions;
  batchMeta: BatchMeta[];
  errors: Record<string, string>;
};

export function StepAcademic({ draft, setDraft, lookups, batchMeta, errors }: Props) {
  const semesterSequence = draft.currentSemester ?? 1;
  const majors = useEligibleMajors({
    programVersionId: draft.programVersionId,
    semesterSequence,
    enabled: Boolean(draft.programVersionId),
  });
  const pools = useAdmissionPools({
    programVersionId: draft.programVersionId,
    semesterSequence,
    shiftId: draft.primaryShiftId || undefined,
    majorSubjectSlug: draft.majorSubjectSlug || undefined,
    enabled: Boolean(draft.programVersionId),
  });
  const needsMinor = minorRequired(
    pools.data?.semesterRule ?? { categoryCounts: pools.data?.categoryCounts ?? {} },
  );

  const minors = useEligibleMinors({
    programVersionId: draft.programVersionId,
    majorSubjectSlug: draft.majorSubjectSlug,
    semesterSequence,
    enabled: Boolean(draft.programVersionId && draft.majorSubjectSlug && needsMinor),
  });

  useEffect(() => {
    if (!draft.programVersionId) return;
    const templateStream = pools.data?.template?.streamId;
    if (templateStream && !draft.streamId) {
      setDraft((d) => ({ ...d, streamId: templateStream }));
    }
  }, [draft.programVersionId, draft.streamId, pools.data?.template?.streamId, setDraft]);

  useEffect(() => {
    if (!draft.admissionBatchId) return;
    const batch = batchMeta.find((b) => b.id === draft.admissionBatchId);
    if (batch && !draft.currentSemester) {
      setDraft((d) => ({ ...d, currentSemester: batch.currentSemester }));
    }
  }, [draft.admissionBatchId, draft.currentSemester, batchMeta, setDraft]);

  useEffect(() => {
    const majorOptions = majors.data ?? [];
    if (majorOptions.length === 1 && !draft.majorSubjectId) {
      const m = majorOptions[0]!;
      setDraft((d) => ({
        ...d,
        majorSubjectId: m.id,
        majorSubjectSlug: m.slug,
        majorCourseOfferingId: '',
      }));
    }
  }, [majors.data, draft.majorSubjectId, setDraft]);

  useEffect(() => {
    if (!pools.data) return;
    const majorOffering = pools.data.major.find(
      (m) =>
        m.course?.subjectSlug === draft.majorSubjectSlug ||
        m.course?.department?.name?.toLowerCase().replace(/\s+/g, '-') === draft.majorSubjectSlug,
    );
    const minorOffering = pools.data.minor.find(
      (m) =>
        m.course?.subjectSlug === draft.minorSubjectSlug ||
        m.course?.department?.name?.toLowerCase().replace(/\s+/g, '-') === draft.minorSubjectSlug,
    );
    setDraft((d) => {
      const creditsTarget = pools.data?.creditTarget ?? d.subjectBasketMeta.creditsTarget;
      const categoriesComplete = [
        ...(d.majorSubjectSlug ? ['MAJOR'] : []),
        ...(d.minorSubjectSlug ? ['MINOR'] : []),
        ...(d.subjectBasketMeta.categoriesComplete ?? []).filter(
          (c) => c !== 'MAJOR' && c !== 'MINOR',
        ),
      ];
      if (
        d.subjectBasketMeta.creditsTarget === creditsTarget &&
        d.subjectBasketMeta.categoriesComplete?.includes('MAJOR') === Boolean(d.majorSubjectSlug) &&
        d.subjectBasketMeta.categoriesComplete?.includes('MINOR') === Boolean(d.minorSubjectSlug)
      ) {
        return {
          ...d,
          majorCourseOfferingId: majorOffering?.id ?? d.majorCourseOfferingId,
          minorCourseOfferingId: minorOffering?.id ?? d.minorCourseOfferingId,
        };
      }
      return {
        ...d,
        majorCourseOfferingId: majorOffering?.id ?? d.majorCourseOfferingId,
        minorCourseOfferingId: minorOffering?.id ?? d.minorCourseOfferingId,
        subjectBasketMeta: {
          ...d.subjectBasketMeta,
          creditsTarget,
          categoriesComplete: [...new Set(categoriesComplete)],
        },
      };
    });
  }, [pools.data, draft.majorSubjectSlug, draft.minorSubjectSlug, setDraft]);

  const majorLocked = (majors.data?.length ?? 0) === 1;
  const filteredBatches = draft.programVersionId
    ? lookups.batchOptions.filter((b) => {
        const meta = batchMeta.find((m) => m.id === b.id);
        return !meta?.programVersionId || meta.programVersionId === draft.programVersionId;
      })
    : lookups.batchOptions;

  return (
    <div className="space-y-3 overflow-visible">
      <ErpFormSection title="Programme & batch" description="Academic placement">
        <ErpFormGrid cols={3}>
          <GlassField
            label="Programme"
            error={errors.programVersionId}
            className="sm:col-span-2 lg:col-span-3"
          >
            <select
              className={glassSelectClass}
              value={draft.programVersionId}
              onChange={(e) => {
                const programVersionId = e.target.value;
                const linkedDepartmentId = resolveDepartmentIdForProgramVersion(
                  programVersionId,
                  lookups.programVersionDepartmentMap,
                );
                setDraft((d) => ({
                  ...d,
                  programVersionId,
                  departmentId: linkedDepartmentId ?? '',
                  majorSubjectId: '',
                  minorSubjectId: '',
                  majorSubjectSlug: '',
                  minorSubjectSlug: '',
                  majorCourseOfferingId: '',
                  minorCourseOfferingId: '',
                  subjectSelections: {},
                }));
              }}
            >
              <option value="">Select programme</option>
              {lookups.programOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Admission batch" error={errors.admissionBatchId}>
            <select
              className={glassSelectClass}
              value={draft.admissionBatchId}
              disabled={!draft.programVersionId}
              onChange={(e) => setDraft((d) => ({ ...d, admissionBatchId: e.target.value }))}
            >
              <option value="">Select batch</option>
              {filteredBatches.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Stream" error={errors.streamId}>
            <select
              className={glassSelectClass}
              value={draft.streamId}
              disabled={!draft.programVersionId}
              onChange={(e) => setDraft((d) => ({ ...d, streamId: e.target.value }))}
            >
              <option value="">Select stream</option>
              {lookups.streamOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Shift" error={errors.primaryShiftId}>
            <select
              className={glassSelectClass}
              value={draft.primaryShiftId}
              disabled={!draft.programVersionId}
              onChange={(e) => setDraft((d) => ({ ...d, primaryShiftId: e.target.value }))}
            >
              <option value="">Select shift</option>
              {lookups.shiftOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </GlassField>
          <GlassField label="Department">
            <SearchableDepartmentSelect
              value={draft.departmentId}
              options={lookups.departmentOptions}
              disabled={!draft.programVersionId}
              placeholder="Select academic department"
              onChange={(departmentId) => setDraft((d) => ({ ...d, departmentId }))}
            />
          </GlassField>
          <GlassField label="Current semester">
            <input
              type="number"
              min={1}
              max={8}
              className={glassInputClass}
              placeholder="Batch default"
              value={draft.currentSemester ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  currentSemester: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </GlassField>
          <GlassField label="Admission date">
            <DateInput
              className={glassInputClass}
              value={draft.admissionDate}
              onChange={(admissionDate) => setDraft((d) => ({ ...d, admissionDate }))}
            />
          </GlassField>
          <GlassField label="Admission type">
            <select
              className={glassSelectClass}
              value={draft.admissionType}
              onChange={(e) => setDraft((d) => ({ ...d, admissionType: e.target.value }))}
            >
              {['REGULAR', 'LATERAL', 'MIGRATION', 'RE_ADMISSION'].map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </GlassField>
        </ErpFormGrid>
      </ErpFormSection>

      <ErpFormSection
        title={needsMinor ? 'Major & minor subject paths' : 'Major subject path'}
        description="Select subject paths — semester papers are assigned automatically. Major/minor paths lock after Semester 1 promotion."
      >
        <ErpFormGrid>
          <SearchableSubjectPathSelect
            label="Major subject"
            value={draft.majorSubjectId}
            options={majors.data ?? []}
            disabled={!draft.programVersionId || majors.isLoading}
            readOnly={majorLocked}
            placeholder="Select major subject"
            searchPlaceholder="Search major subject…"
            subjectRoleLabel="Major Subject"
            error={errors.majorSubjectSlug}
            onChange={(id, subject) =>
              setDraft((d) => ({
                ...d,
                majorSubjectId: id,
                majorSubjectSlug: subject?.slug ?? '',
                minorSubjectId: '',
                minorSubjectSlug: '',
                minorCourseOfferingId: '',
              }))
            }
          />
          {needsMinor ? (
            <SearchableSubjectPathSelect
              label="Minor subject"
              value={draft.minorSubjectId}
              options={minors.data ?? []}
              disabled={!draft.programVersionId || !draft.majorSubjectSlug || minors.isLoading}
              placeholder="Select minor subject"
              searchPlaceholder="Search minor subject…"
              subjectRoleLabel="Minor Subject"
              error={errors.minorSubjectSlug}
              onChange={(id, subject) =>
                setDraft((d) => ({
                  ...d,
                  minorSubjectId: id,
                  minorSubjectSlug: subject?.slug ?? '',
                  minorCourseOfferingId: '',
                }))
              }
            />
          ) : null}
        </ErpFormGrid>
        {majors.isLoading || (needsMinor && minors.isLoading) ? (
          <p className="mt-1 text-[10px] text-muted-foreground">Loading eligible subject paths…</p>
        ) : null}
        {needsMinor &&
        draft.majorSubjectSlug &&
        (minors.data?.length ?? 0) === 0 &&
        !minors.isLoading ? (
          <p className="mt-1 text-[10px] text-amber-700">
            No eligible minors for the selected major in this programme.
          </p>
        ) : null}
      </ErpFormSection>

      <Class12AcademicBackgroundSection draft={draft} setDraft={setDraft} errors={errors} />
    </div>
  );
}
