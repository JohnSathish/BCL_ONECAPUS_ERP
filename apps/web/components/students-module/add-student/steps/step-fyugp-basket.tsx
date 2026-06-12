'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

import { ErpFormSection } from '@/components/erp/erp-workspace-shell';
import { useAdmissionPools } from '@/components/students-module/add-student/hooks/use-admission-pools';
import {
  useEligibleMajors,
  useEligibleMinors,
} from '@/components/students-module/add-student/hooks/use-eligible-subjects';
import {
  buildAutoSlotKeys,
  buildSelectableSlotKeys,
  buildSlotKeys,
  useSubjectBasket,
} from '@/components/students-module/add-student/hooks/use-subject-basket';
import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
import { isClass12BackgroundComplete } from '@/components/students-module/add-student/utils/admission-validation';
import { AutoAssignedSubjectCard } from '@/components/students-module/add-student/ui/auto-assigned-subject-card';
import { RegistrationAssignmentPreview } from '@/components/students-module/add-student/ui/registration-assignment-preview';
import { SubjectCategoryCard } from '@/components/students-module/add-student/ui/subject-category-card';
import {
  resolveSectionForSlotWithSelections,
  slotCategory,
} from '@/components/students-module/add-student/utils/subject-basket';
import { Button } from '@/components/ui/button';
import { fetchCatalog } from '@/services/academic-engine';
import {
  buildSectionsByCategory,
  ineligibleForCategory,
  normalizeCatalogResponse,
} from '@/utils/catalog-eligibility';
import { validateAdmissionSubjectBasket } from '@/services/students';
import {
  buildAssignedSubjectRows,
  detectDuplicateCourseCodes,
} from '@/utils/assigned-subject-display';
import { cn } from '@/utils/cn';
import {
  categoryLabel,
  formatSemesterSummary,
  minorRequired,
  requiredCategories,
} from '@/utils/semester-rules';
import { electiveSlotBadge } from '@/utils/vtc-track-utils';

type Props = {
  draft: AddStudentDraft;
  setDraft: React.Dispatch<React.SetStateAction<AddStudentDraft>>;
  errors: Record<string, string>;
  onValidationIssues?: (issues: string[]) => void;
};

function enrichBasketMeta(
  meta: AddStudentDraft['subjectBasketMeta'],
  pools: ReturnType<typeof useAdmissionPools>['data'],
): AddStudentDraft['subjectBasketMeta'] {
  const rule = pools?.semesterRule ?? {
    categoryCounts: pools?.categoryCounts ?? {},
  };
  return {
    ...meta,
    creditsTarget: meta.creditsTarget || pools?.creditTarget || 0,
    requiredCategories: requiredCategories(rule),
    semesterSummary: pools?.semesterSummary ?? formatSemesterSummary(rule),
    minorRequired: minorRequired(rule),
  };
}

export function StepFyugpBasket({ draft, setDraft, errors, onValidationIssues }: Props) {
  const semesterSequence = draft.currentSemester ?? 1;
  const pools = useAdmissionPools({
    programVersionId: draft.programVersionId,
    semesterSequence,
    shiftId: draft.primaryShiftId || undefined,
    majorSubjectSlug: draft.majorSubjectSlug || undefined,
    enabled: Boolean(draft.programVersionId && draft.primaryShiftId),
  });

  const needsMinor = minorRequired(
    pools.data?.semesterRule ?? { categoryCounts: pools.data?.categoryCounts ?? {} },
  );

  const majors = useEligibleMajors({
    programVersionId: draft.programVersionId,
    semesterSequence,
    enabled: Boolean(draft.programVersionId),
  });
  const minors = useEligibleMinors({
    programVersionId: draft.programVersionId,
    majorSubjectSlug: draft.majorSubjectSlug,
    semesterSequence,
    enabled: Boolean(draft.programVersionId && draft.majorSubjectSlug && needsMinor),
  });

  const catalog = useQuery({
    queryKey: [
      'admission-catalog',
      draft.programVersionId,
      semesterSequence,
      draft.primaryShiftId,
      draft.streamId,
      draft.majorSubjectSlug,
      draft.minorSubjectSlug,
      draft.class12Subjects,
    ],
    queryFn: () =>
      fetchCatalog({
        programVersionId: draft.programVersionId,
        semesterSequence,
        shiftId: draft.primaryShiftId,
        streamId: draft.streamId || undefined,
        majorSubjectSlug: draft.majorSubjectSlug || undefined,
        minorSubjectSlug: draft.minorSubjectSlug || undefined,
        includeIneligible: true,
        class12Subjects:
          draft.class12Subjects.length > 0 ? JSON.stringify(draft.class12Subjects) : undefined,
      }),
    enabled: Boolean(
      draft.programVersionId && draft.primaryShiftId && draft.class12Subjects.length > 0,
    ),
  });

  const slotKeys = useMemo(
    () => buildSlotKeys(pools.data, semesterSequence),
    [pools.data, semesterSequence],
  );
  const autoSlotKeys = useMemo(
    () => buildAutoSlotKeys(pools.data, semesterSequence),
    [pools.data, semesterSequence],
  );
  const selectableSlotKeys = useMemo(
    () => buildSelectableSlotKeys(pools.data, semesterSequence),
    [pools.data, semesterSequence],
  );

  const catalogPartition = useMemo(
    () => normalizeCatalogResponse(catalog.data ?? { eligible: [], ineligible: [] }),
    [catalog.data],
  );
  const catalogRows = catalogPartition.eligible;
  const catalogIneligible = catalogPartition.ineligible;

  const majorName =
    majors.data?.find((m) => m.slug === draft.majorSubjectSlug)?.name ?? draft.majorSubjectSlug;
  const minorName =
    minors.data?.find((m) => m.slug === draft.minorSubjectSlug)?.name ?? draft.minorSubjectSlug;

  const { sectionsByCategory, autoAssign, metaFromSelections, withAutoAssigned } = useSubjectBasket(
    {
      pools: pools.data,
      catalog: catalogRows,
      slotKeys,
      autoSlotKeys,
      selectableSlotKeys,
      majorSubjectSlug: draft.majorSubjectSlug,
      minorSubjectSlug: draft.minorSubjectSlug,
      semesterSequence,
    },
  );

  const debouncedSelections = useDebouncedValue(draft.subjectSelections, 400);

  const validation = useQuery({
    queryKey: [
      'validate-basket',
      draft.programVersionId,
      semesterSequence,
      draft.primaryShiftId,
      draft.majorSubjectSlug,
      draft.minorSubjectSlug,
      needsMinor,
      draft.class12Subjects,
      debouncedSelections,
    ],
    queryFn: () =>
      validateAdmissionSubjectBasket({
        programVersionId: draft.programVersionId,
        semesterSequence,
        shiftId: draft.primaryShiftId,
        streamId: draft.streamId,
        majorSubjectSlug: draft.majorSubjectSlug,
        minorSubjectSlug: draft.minorSubjectSlug,
        class12Subjects: draft.class12Subjects,
        selections: debouncedSelections,
      }),
    enabled: Boolean(
      draft.programVersionId &&
      draft.class12Subjects.length > 0 &&
      draft.majorSubjectSlug &&
      (!needsMinor || draft.minorSubjectSlug) &&
      Object.keys(debouncedSelections).length > 0,
    ),
  });

  useEffect(() => {
    const issues = validation.data?.issues?.map((i) => i.message) ?? [];
    onValidationIssues?.(validation.data && !validation.data.ok ? issues : []);
  }, [validation.data, onValidationIssues]);

  useEffect(() => {
    if (!draft.majorSubjectSlug || !catalog.data) return;
    if (needsMinor && !draft.minorSubjectSlug) return;
    setDraft((d) => {
      const next = withAutoAssigned(d.subjectSelections);
      const meta = enrichBasketMeta(metaFromSelections(next), pools.data);
      const sameKeys =
        Object.keys(next).length === Object.keys(d.subjectSelections).length &&
        Object.entries(next).every(([k, v]) => d.subjectSelections[k] === v);
      const sameMeta =
        d.subjectBasketMeta.creditsSelected === meta.creditsSelected &&
        d.subjectBasketMeta.creditsTarget === meta.creditsTarget &&
        JSON.stringify(d.subjectBasketMeta.categoriesComplete ?? []) ===
          JSON.stringify(meta.categoriesComplete) &&
        JSON.stringify(d.subjectBasketMeta.missingPoolCategories ?? []) ===
          JSON.stringify(meta.missingPoolCategories) &&
        d.subjectBasketMeta.minorRequired === meta.minorRequired &&
        d.subjectBasketMeta.semesterSummary === meta.semesterSummary;
      if (sameKeys && sameMeta) return d;
      return {
        ...d,
        subjectSelections: next,
        subjectBasketMeta: meta,
      };
    });
  }, [
    draft.majorSubjectSlug,
    draft.minorSubjectSlug,
    needsMinor,
    catalog.data,
    pools.data,
    autoSlotKeys.join(','),
    withAutoAssigned,
    metaFromSelections,
    setDraft,
  ]);

  if (!draft.programVersionId || !draft.primaryShiftId) {
    return (
      <p className="text-xs text-muted-foreground">
        Complete Academic Details (programme and shift) before assigning FYUGP subjects.
      </p>
    );
  }

  if (!isClass12BackgroundComplete(draft)) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300">
        Complete Class XII Academic Background on the Academic step before subject registration.
      </p>
    );
  }

  if (!draft.majorSubjectSlug || (needsMinor && !draft.minorSubjectSlug)) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300">
        {needsMinor
          ? 'Select major and minor subject paths in Academic Details before semester registration.'
          : 'Select a major subject path in Academic Details before semester registration.'}
      </p>
    );
  }

  const creditsSelected = draft.subjectBasketMeta.creditsSelected ?? 0;
  const creditsTarget = draft.subjectBasketMeta.creditsTarget ?? 0;
  const poolFilled = (draft.subjectBasketMeta.missingPoolCategories ?? []).length === 0;
  const semesterSummary =
    draft.subjectBasketMeta.semesterSummary ??
    pools.data?.semesterSummary ??
    formatSemesterSummary(pools.data?.semesterRule ?? undefined);

  const resolveSlotSection = (slotKey: string) =>
    resolveSectionForSlotWithSelections(
      catalogRows,
      pools.data,
      slotKey,
      draft.subjectSelections,
      draft.majorSubjectSlug,
      draft.minorSubjectSlug,
      semesterSequence,
    );

  const autoAssignedSections = autoSlotKeys.map((slotKey) => resolveSlotSection(slotKey));
  const { duplicateCodes } = detectDuplicateCourseCodes(autoAssignedSections);

  const previewRows = buildAssignedSubjectRows({
    slotKeys,
    autoSlotKeys,
    selections: draft.subjectSelections,
    catalog: catalogRows,
    resolveSection: resolveSlotSection,
    pathNames: { MAJOR: majorName, MINOR: minorName },
  }).map((row) => ({
    ...row,
    badgeLabel:
      row.category === 'MAJOR' || row.category === 'MINOR'
        ? 'Locked after Sem 1'
        : electiveSlotBadge(row.category, semesterSequence),
    helperText:
      row.category === 'MAJOR' || row.category === 'MINOR'
        ? 'Locked after Semester 1 promotion'
        : undefined,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold">FYUGP Semester {semesterSequence} Registration</h3>
          <p className="text-[11px] text-muted-foreground">
            {semesterSummary || 'Configure subjects for this semester'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              creditsTarget && creditsSelected >= creditsTarget
                ? 'bg-emerald-500/15 text-emerald-700'
                : 'bg-primary/10 text-primary',
            )}
          >
            {creditsSelected}
            {creditsTarget ? ` / ${creditsTarget} credits` : ' credits'}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() =>
              setDraft((d) => {
                const next = autoAssign(d.subjectSelections);
                return {
                  ...d,
                  subjectSelections: next,
                  subjectBasketMeta: enrichBasketMeta(metaFromSelections(next), pools.data),
                };
              })
            }
          >
            Auto Assign
          </Button>
        </div>
      </div>

      {errors.subjectSelections ? (
        <p className="text-xs text-destructive">{errors.subjectSelections}</p>
      ) : null}
      {validation.data && !validation.data.ok ? (
        <ul className="space-y-0.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
          {validation.data.issues.map((issue) => (
            <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}

      {autoSlotKeys.length > 0 ? (
        <ErpFormSection
          title="Auto-assigned subjects"
          description="From major/minor paths selected in Academic Details"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {autoSlotKeys.map((slotKey) => {
              const category = slotCategory(slotKey);
              const section = resolveSlotSection(slotKey);
              const pathName = category === 'MAJOR' ? majorName : minorName;
              const duplicateWarning =
                Boolean(section) && duplicateCodes.includes(section!.courseOffering.course.code);
              return (
                <AutoAssignedSubjectCard
                  key={slotKey}
                  category={category}
                  label={categoryLabel(category, slotKey)}
                  pathName={pathName}
                  section={section}
                  pending={catalog.isLoading || pools.isLoading}
                  duplicateWarning={duplicateWarning}
                  lockNote={
                    category === 'MAJOR' || category === 'MINOR'
                      ? 'Locked after Semester 1 promotion'
                      : undefined
                  }
                />
              );
            })}
          </div>
        </ErpFormSection>
      ) : null}

      <ErpFormSection
        title="Selectable subjects"
        description={
          poolFilled
            ? 'All semester pool categories selected'
            : `Choose pool subjects for this semester${(draft.subjectBasketMeta.missingPoolCategories ?? []).length ? `: ${(draft.subjectBasketMeta.missingPoolCategories ?? []).join(', ')}` : ''}`
        }
      >
        {selectableSlotKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pool categories for this semester.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {selectableSlotKeys.map((slotKey) => {
              const cat = slotCategory(slotKey);
              return (
                <SubjectCategoryCard
                  key={slotKey}
                  slotKey={slotKey}
                  label={categoryLabel(cat, slotKey)}
                  sections={sectionsByCategory.get(cat) ?? []}
                  ineligibleSections={ineligibleForCategory(catalogIneligible, cat)}
                  value={draft.subjectSelections[slotKey] ?? ''}
                  badgeLabel={electiveSlotBadge(cat, semesterSequence)}
                  onChange={(sectionId) =>
                    setDraft((d) => {
                      const next = withAutoAssigned({
                        ...d.subjectSelections,
                        [slotKey]: sectionId,
                      });
                      return {
                        ...d,
                        subjectSelections: next,
                        subjectBasketMeta: enrichBasketMeta(metaFromSelections(next), pools.data),
                      };
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </ErpFormSection>

      <RegistrationAssignmentPreview title="Registration preview" rows={previewRows} showDebug />
    </div>
  );
}
