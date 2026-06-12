'use client';

import { useState } from 'react';

import type { CatalogSectionRow, IneligibleCatalogSection } from '@/types/academic-engine';

type ElectiveSlotPickerProps = {
  slotKey: string;
  label: string;
  sections: CatalogSectionRow[];
  ineligibleSections?: IneligibleCatalogSection[];
  value: string;
  disabled?: boolean;
  locked?: boolean;
  badgeLabel?: string;
  overrideReason?: string;
  allowIneligiblePick?: boolean;
  onChange: (sectionId: string) => void;
  onIneligiblePick?: (sectionId: string, reasons: string[]) => void;
};

function formatOptionLabel(s: CatalogSectionRow) {
  return `${s.courseOffering.course.code} — ${s.sectionCode} (${s.seatLedger?.confirmedCount ?? 0}/${s.capacity})${
    s.mappingSource === 'SHARED_POOL' ? ' · pool' : ''
  }`;
}

export function ElectiveSlotPicker({
  slotKey,
  label,
  sections,
  ineligibleSections = [],
  value,
  disabled,
  locked,
  badgeLabel,
  overrideReason,
  allowIneligiblePick,
  onChange,
  onIneligiblePick,
}: ElectiveSlotPickerProps) {
  const [showUnavailable, setShowUnavailable] = useState(false);

  return (
    <label key={slotKey} className="block space-y-1 text-sm">
      <span className="flex flex-wrap items-center gap-2">
        {label}
        {overrideReason ? (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
            Eligibility overridden
          </span>
        ) : null}
        {locked ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            {badgeLabel ?? 'Auto-assigned'}
          </span>
        ) : badgeLabel ? (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
            {badgeLabel}
          </span>
        ) : null}
      </span>
      <select
        className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm disabled:opacity-60"
        value={value}
        disabled={disabled || locked}
        onChange={(e) => {
          const picked = ineligibleSections.find((row) => row.section.id === e.target.value);
          if (picked) {
            if (allowIneligiblePick && onIneligiblePick) {
              onIneligiblePick(e.target.value, picked.reasons);
            }
            return;
          }
          onChange(e.target.value);
        }}
      >
        <option value="">Select section</option>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {formatOptionLabel(s)}
          </option>
        ))}
        {ineligibleSections.map((row) => (
          <option
            key={row.section.id}
            value={row.section.id}
            disabled={!allowIneligiblePick}
            title={row.reasons[0]}
          >
            {formatOptionLabel(row.section)} — {row.reasons[0]}
          </option>
        ))}
      </select>
      {overrideReason ? (
        <p className="text-[11px] text-muted-foreground">Override: {overrideReason}</p>
      ) : null}
      {ineligibleSections.length > 0 ? (
        <div>
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setShowUnavailable((v) => !v)}
          >
            {showUnavailable ? 'Hide' : 'Show'} unavailable courses ({ineligibleSections.length})
          </button>
          {showUnavailable ? (
            <ul className="mt-1 space-y-1 rounded border border-border/50 bg-muted/20 p-2 text-[11px]">
              {ineligibleSections.map((row) => (
                <li key={row.section.id}>
                  <span className="font-medium">
                    {row.section.courseOffering.course.code} —{' '}
                    {row.section.courseOffering.course.title}
                  </span>
                  <span className="block text-destructive/90">{row.reasons[0]}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </label>
  );
}
