'use client';

import { useMemo, useState } from 'react';

import { CATEGORY_COLORS } from '@/components/students-module/add-student/constants';
import { SearchableSectionSelect } from '@/components/students-module/add-student/ui/searchable-section-select';
import { slotCategory } from '@/components/students-module/add-student/utils/subject-basket';
import type { CatalogSectionRow, IneligibleCatalogSection } from '@/types/academic-engine';
import { cn } from '@/utils/cn';

type Props = {
  slotKey: string;
  label: string;
  sections: CatalogSectionRow[];
  ineligibleSections?: IneligibleCatalogSection[];
  value: string;
  locked?: boolean;
  badgeLabel?: string;
  onChange: (sectionId: string) => void;
  onIneligiblePick?: (sectionId: string, reasons: string[]) => void;
  allowIneligiblePick?: boolean;
  overrideReason?: string;
  showUnavailableByDefault?: boolean;
};

const ELIGIBILITY_CATEGORIES = new Set(['MDC', 'AEC', 'VTC']);

export function SubjectCategoryCard({
  slotKey,
  label,
  sections,
  ineligibleSections = [],
  value,
  locked,
  badgeLabel,
  onChange,
  onIneligiblePick,
  allowIneligiblePick,
  overrideReason,
  showUnavailableByDefault,
}: Props) {
  const category = slotCategory(slotKey);
  const selected =
    sections.find((s) => s.id === value) ??
    ineligibleSections.find((row) => row.section.id === value)?.section;
  const defaultExpanded =
    showUnavailableByDefault ??
    (ineligibleSections.length > 0 && ELIGIBILITY_CATEGORIES.has(category));
  const [showUnavailable, setShowUnavailable] = useState(defaultExpanded);

  const availabilitySummary = useMemo(() => {
    const available = sections.length;
    const disabled = ineligibleSections.length;
    return { available, disabled };
  }, [sections.length, ineligibleSections.length]);

  return (
    <div
      className={cn(
        'glass-card rounded-lg border p-2 transition-shadow',
        CATEGORY_COLORS[category] ?? 'border-border/60',
        locked && 'opacity-90',
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1">
          {overrideReason ? (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 dark:text-amber-200">
              Eligibility overridden
            </span>
          ) : null}
          {locked ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium">
              {badgeLabel ?? 'Locked'}
            </span>
          ) : badgeLabel ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>
      {!locked && ineligibleSections.length > 0 ? (
        <p className="mb-1 text-[10px] text-muted-foreground">
          Available: {availabilitySummary.available} · Disabled: {availabilitySummary.disabled}
        </p>
      ) : null}
      {locked && selected ? (
        <div className="text-[11px]">
          <p className="truncate font-medium">
            {selected.courseOffering.course.code} — {selected.courseOffering.course.title}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {selected.sectionCode} · {selected.seatLedger?.confirmedCount ?? 0}/{selected.capacity}{' '}
            seats
          </p>
        </div>
      ) : (
        <>
          <SearchableSectionSelect
            sections={sections}
            ineligibleSections={ineligibleSections}
            value={value}
            disabled={locked}
            allowIneligiblePick={allowIneligiblePick}
            onChange={onChange}
            onIneligiblePick={onIneligiblePick}
          />
          {overrideReason ? (
            <p className="mt-1 text-[10px] text-muted-foreground">Override: {overrideReason}</p>
          ) : null}
          {ineligibleSections.length > 0 ? (
            <div className="mt-1.5">
              <button
                type="button"
                className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setShowUnavailable((v) => !v)}
              >
                {showUnavailable ? 'Hide' : 'Show'} unavailable courses ({ineligibleSections.length}
                )
              </button>
              {showUnavailable ? (
                <ul className="mt-1 space-y-1.5 rounded border border-border/50 bg-muted/20 p-1.5">
                  {ineligibleSections.map((row) => (
                    <li
                      key={row.section.id}
                      className="rounded border border-border/40 bg-background/60 p-1.5 text-[10px]"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-medium">
                          {row.section.courseOffering.course.code} —{' '}
                          {row.section.courseOffering.course.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-medium text-destructive">
                          Unavailable
                        </span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">
                        <span className="font-medium">Reason:</span> {row.reasons[0]}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
