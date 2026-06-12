'use client';

import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';

import { glassSelectClass } from '@/components/students-module/add-student/ui/glass-field';
import type { CatalogSectionRow, IneligibleCatalogSection } from '@/types/academic-engine';
import { cn } from '@/utils/cn';

export type IneligibleSectionOption = IneligibleCatalogSection;

type Props = {
  sections: CatalogSectionRow[];
  ineligibleSections?: IneligibleSectionOption[];
  value: string;
  onChange: (sectionId: string) => void;
  onIneligiblePick?: (sectionId: string, reasons: string[]) => void;
  allowIneligiblePick?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

function formatSectionLabel(s: CatalogSectionRow) {
  const code = s.courseOffering.course.code;
  const title = s.courseOffering.course.title;
  const seats = `${s.seatLedger?.confirmedCount ?? 0}/${s.capacity}`;
  return `${code} — ${title} · ${s.sectionCode} (${seats})`;
}

export function SearchableSectionSelect({
  sections,
  ineligibleSections = [],
  value,
  onChange,
  onIneligiblePick,
  allowIneligiblePick = false,
  disabled,
  placeholder = 'Select section',
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected =
    sections.find((s) => s.id === value) ??
    ineligibleSections.find((row) => row.section.id === value)?.section;

  const filteredEligible = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections.filter((s) => {
      const code = s.courseOffering.course.code.toLowerCase();
      const title = s.courseOffering.course.title.toLowerCase();
      const section = s.sectionCode.toLowerCase();
      return code.includes(q) || title.includes(q) || section.includes(q);
    });
  }, [sections, query]);

  const filteredIneligible = useMemo(() => {
    if (!query.trim()) return ineligibleSections;
    const q = query.toLowerCase();
    return ineligibleSections.filter((row) => {
      const s = row.section;
      const code = s.courseOffering.course.code.toLowerCase();
      const title = s.courseOffering.course.title.toLowerCase();
      const section = s.sectionCode.toLowerCase();
      return code.includes(q) || title.includes(q) || section.includes(q);
    });
  }, [ineligibleSections, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const handlePick = (sectionId: string, ineligible?: IneligibleSectionOption) => {
    if (ineligible) {
      if (allowIneligiblePick && onIneligiblePick) {
        onIneligiblePick(sectionId, ineligible.reasons);
        close();
      }
      return;
    }
    onChange(sectionId);
    close();
  };

  const totalOptions = sections.length + ineligibleSections.length;

  if (totalOptions <= 1) {
    return (
      <select
        className="h-8 w-full rounded-lg border border-border/60 bg-background/80 px-2 text-[11px]"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const picked = ineligibleSections.find((row) => row.section.id === e.target.value);
          if (picked) {
            handlePick(e.target.value, picked);
            return;
          }
          onChange(e.target.value);
        }}
      >
        <option value="">{placeholder}</option>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {formatSectionLabel(s)}
          </option>
        ))}
        {ineligibleSections.map((row) => (
          <option
            key={row.section.id}
            value={row.section.id}
            disabled={!allowIneligiblePick}
            title={row.reasons[0]}
          >
            {formatSectionLabel(row.section)} — {row.reasons[0]}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'flex h-8 w-full items-center rounded-lg border border-border/60 bg-background/80 transition-colors',
          open && 'border-primary/40 ring-1 ring-primary/30',
          disabled && 'opacity-60',
        )}
      >
        <input
          className="min-w-0 flex-1 bg-transparent px-2 text-[11px] outline-none placeholder:text-muted-foreground"
          placeholder={selected && !query ? formatSectionLabel(selected) : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => close(), 150)}
          disabled={disabled}
        />
        <button
          type="button"
          tabIndex={-1}
          className="flex h-8 w-7 shrink-0 items-center justify-center text-muted-foreground"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && !disabled ? (
        <ul className="absolute z-20 mt-0.5 max-h-48 w-full overflow-y-auto rounded-lg border border-border/60 bg-background shadow-lg">
          {filteredEligible.length === 0 && filteredIneligible.length === 0 ? (
            <li className="px-2 py-1.5 text-[11px] text-muted-foreground">No matches</li>
          ) : (
            <>
              {filteredEligible.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full px-2 py-1.5 text-left text-[11px] hover:bg-muted/60',
                      value === s.id && 'bg-primary/10 font-medium text-primary',
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePick(s.id)}
                  >
                    <p>{formatSectionLabel(s)}</p>
                    {s.poolName ? (
                      <p className="text-[10px] text-muted-foreground">Pool: {s.poolName}</p>
                    ) : null}
                  </button>
                </li>
              ))}
              {filteredIneligible.map((row) => (
                <li key={row.section.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full px-2 py-1.5 text-left text-[11px]',
                      allowIneligiblePick
                        ? 'hover:bg-amber-500/10'
                        : 'cursor-not-allowed opacity-60',
                      value === row.section.id && 'bg-amber-500/15 font-medium',
                    )}
                    disabled={!allowIneligiblePick}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePick(row.section.id, row)}
                  >
                    <p className="text-muted-foreground">{formatSectionLabel(row.section)}</p>
                    <p className="text-[10px] text-destructive/90">{row.reasons[0]}</p>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      ) : null}
      <select
        className={cn(glassSelectClass, 'sr-only')}
        tabIndex={-1}
        aria-hidden
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {formatSectionLabel(s)}
          </option>
        ))}
      </select>
    </div>
  );
}
