'use client';

import { AlertTriangle, Check, User } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { AddStudentDraft } from '@/components/students-module/add-student/types/draft';
import { computeProfileCompletion } from '@/components/students-module/add-student/utils/completion';
import { RegistrationAssignmentPreview } from '@/components/students-module/add-student/ui/registration-assignment-preview';
import { resolveSectionForSlotWithSelections } from '@/components/students-module/add-student/utils/subject-basket';
import { fetchCatalog } from '@/services/academic-engine';
import { normalizeCatalogResponse } from '@/utils/catalog-eligibility';
import { buildAssignedSubjectRows } from '@/utils/assigned-subject-display';
import { cn } from '@/utils/cn';
import { StudentName } from '@/components/students/student-name';
import { categoryLabel, requiredCategories } from '@/utils/semester-rules';

type Props = {
  draft: AddStudentDraft;
  programmeLabel?: string;
  batchLabel?: string;
  validationIssues?: string[];
  className?: string;
  compact?: boolean;
};

function isCategoryComplete(
  category: string,
  draft: AddStudentDraft,
  categories: string[],
): boolean {
  if (categories.includes(category)) return true;
  if (category === 'MAJOR') return Boolean(draft.majorSubjectSlug);
  if (category === 'MINOR') return Boolean(draft.minorSubjectSlug);
  return false;
}

export function AddStudentSummaryPanel({
  draft,
  programmeLabel,
  batchLabel,
  validationIssues = [],
  className,
  compact,
}: Props) {
  const completion = computeProfileCompletion(draft);
  const categories = draft.subjectBasketMeta.categoriesComplete ?? [];
  const creditsSelected = draft.subjectBasketMeta.creditsSelected ?? 0;
  const creditsTarget = draft.subjectBasketMeta.creditsTarget ?? 0;
  const ruleCategories =
    draft.subjectBasketMeta.requiredCategories ??
    requiredCategories({
      categoryCounts: Object.fromEntries(
        (draft.subjectBasketMeta.missingPoolCategories ?? []).map((c) => [c, 1]),
      ),
    });
  const displayCategories =
    ruleCategories.length > 0
      ? ruleCategories
      : ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC', 'VTC'];
  const missingCategories = displayCategories.filter(
    (c) => !isCategoryComplete(c, draft, categories),
  );

  const semesterSequence = draft.currentSemester ?? 1;
  const catalog = useQuery({
    queryKey: [
      'admission-summary-catalog',
      draft.programVersionId,
      semesterSequence,
      draft.primaryShiftId,
    ],
    queryFn: () =>
      fetchCatalog({
        programVersionId: draft.programVersionId,
        semesterSequence,
        shiftId: draft.primaryShiftId,
      }),
    enabled: Boolean(draft.programVersionId && draft.primaryShiftId && draft.majorSubjectSlug),
    staleTime: 60_000,
  });

  const catalogRows = useMemo(
    () => normalizeCatalogResponse(catalog.data ?? []).eligible,
    [catalog.data],
  );

  const previewRows = useMemo(() => {
    const slotKeys = Object.keys(draft.subjectSelections);
    if (!catalogRows.length || !draft.majorSubjectSlug || slotKeys.length === 0) return [];
    const autoSlotKeys = slotKeys.filter((key) => {
      const base = key.split('-')[0];
      return base === 'MAJOR' || base === 'MINOR';
    });
    return buildAssignedSubjectRows({
      slotKeys,
      autoSlotKeys,
      selections: draft.subjectSelections,
      catalog: catalogRows,
      resolveSection: (slotKey) =>
        resolveSectionForSlotWithSelections(
          catalogRows,
          undefined,
          slotKey,
          draft.subjectSelections,
          draft.majorSubjectSlug,
          draft.minorSubjectSlug,
          semesterSequence,
        ),
    });
  }, [
    catalogRows,
    draft.majorSubjectSlug,
    draft.minorSubjectSlug,
    draft.subjectSelections,
    semesterSequence,
  ]);

  return (
    <aside
      className={cn(
        'glass-card space-y-2.5 rounded-xl border border-border/50 p-3 shadow-sm',
        compact && 'text-[11px]',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        {draft.photoPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.photoPreviewUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-primary/30"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {draft.fullName ? <StudentName name={draft.fullName} /> : 'New student'}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {draft.enrollmentNumber || draft.applicationNumber || 'Draft admission'}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Programme</dt>
          <dd className="truncate font-medium">{programmeLabel || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Batch</dt>
          <dd className="truncate font-medium">{batchLabel || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Semester</dt>
          <dd className="font-medium">Sem {draft.currentSemester ?? 1}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Credits</dt>
          <dd className="font-medium tabular-nums">
            {creditsSelected}
            {creditsTarget ? ` / ${creditsTarget}` : ''}
          </dd>
        </div>
      </dl>

      {draft.subjectBasketMeta.semesterSummary ? (
        <p className="text-[10px] text-muted-foreground">
          {draft.subjectBasketMeta.semesterSummary}
        </p>
      ) : null}

      <div>
        <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Completion</span>
          <span className="font-medium tabular-nums text-foreground">{completion}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-medium text-muted-foreground">Semester categories</p>
        <div className="flex flex-wrap gap-1">
          {displayCategories.map((cat) => {
            const ok = isCategoryComplete(cat, draft, categories);
            return (
              <span
                key={cat}
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                  ok
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {ok ? <Check className="h-2.5 w-2.5" /> : null}
                {categoryLabel(cat)}
              </span>
            );
          })}
        </div>
      </div>

      {missingCategories.length > 0 && draft.programVersionId ? (
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          Missing: {missingCategories.map((c) => categoryLabel(c)).join(', ')}
        </p>
      ) : null}

      {validationIssues.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Validation
          </p>
          <ul className="space-y-0.5 text-[10px] text-destructive">
            {validationIssues.slice(0, 4).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {previewRows.length > 0 ? (
        <RegistrationAssignmentPreview title="Assigned papers" rows={previewRows} compact />
      ) : null}
    </aside>
  );
}

/** Mobile bottom drawer trigger content */
export function AddStudentSummaryMobileBar({
  draft,
  programmeLabel,
  onExpand,
}: {
  draft: AddStudentDraft;
  programmeLabel?: string;
  onExpand: () => void;
}) {
  const completion = computeProfileCompletion(draft);
  return (
    <button
      type="button"
      onClick={onExpand}
      className="glass-card fixed bottom-4 left-3 right-3 z-40 flex items-center justify-between rounded-xl border border-primary/20 px-3 py-2 shadow-lg lg:hidden"
    >
      <div className="min-w-0 text-left">
        <p className="truncate text-xs font-semibold">
          {draft.fullName ? <StudentName name={draft.fullName} /> : 'New student'}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {programmeLabel || 'Select programme'} · {completion}% complete
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
        Summary
      </span>
    </button>
  );
}
