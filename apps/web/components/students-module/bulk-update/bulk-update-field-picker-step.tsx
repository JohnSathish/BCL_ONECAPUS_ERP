'use client';

import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

import type { BulkUpdateFieldGroup } from '@/services/student-bulk-update';
import { cn } from '@/utils/cn';

const PRESETS: Record<string, string[]> = {
  'Contact Info': ['mobileNumber', 'email', 'turaAddress', 'homeAddress'],
  'Academic Correction': [
    'programVersionId',
    'majorSubjectSlug',
    'minorSubjectSlug',
    'primaryShiftId',
    'studentStatus',
  ],
  'Family Details': [
    'fatherName',
    'fatherPhone',
    'motherName',
    'motherPhone',
    'guardianName',
    'guardianPhone',
  ],
};

type Props = {
  groups: BulkUpdateFieldGroup[];
  selected: string[];
  onChange: (keys: string[]) => void;
  canPersonal: boolean;
  canAcademic: boolean;
  canSubjects: boolean;
};

export function BulkUpdateFieldPickerStep({
  groups,
  selected,
  onChange,
  canPersonal,
  canAcademic,
  canSubjects,
}: Props) {
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        fields: g.fields.filter((f) => {
          if (f.permission === 'personal' && !canPersonal) return false;
          if (f.permission === 'academic' && !canAcademic) return false;
          if (f.permission === 'subjects' && !canSubjects) return false;
          if (!q) return true;
          return f.label.toLowerCase().includes(q) || f.fieldKey.toLowerCase().includes(q);
        }),
      }))
      .filter((g) => g.fields.length > 0);
  }, [groups, search, canPersonal, canAcademic, canSubjects]);

  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  const applyPreset = (keys: string[]) => {
    const allowed = keys.filter((k) =>
      filteredGroups.some((g) => g.fields.some((f) => f.fieldKey === k)),
    );
    onChange([...new Set([...selected, ...allowed])]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Fields Selection Workspace</h2>
          <p className="text-xs text-muted-foreground">
            Choose identity, academic, administrative, or subject fields. {selected.length}{' '}
            selected.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {selected.length} fields selected
        </span>
      </div>

      <label className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search fields..."
          className="min-w-0 flex-1 bg-transparent outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {Object.entries(PRESETS).map(([label, keys]) => (
          <button
            key={label}
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-[11px] font-medium transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
            onClick={() => applyPreset(keys)}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredGroups.map((group) => (
          <div
            key={group.group}
            className="rounded-3xl border border-border/60 bg-background/60 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.group}
              </h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {group.fields.filter((field) => selected.includes(field.fieldKey)).length}/
                {group.fields.length}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.fields.map((field) => (
                <label
                  key={field.fieldKey}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-2xl border p-3 text-xs transition-all hover:-translate-y-0.5 hover:shadow-sm',
                    selected.includes(field.fieldKey)
                      ? 'border-primary/40 bg-primary/10 ring-1 ring-primary/20'
                      : 'border-border/60 bg-card/70 hover:border-primary/30',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(field.fieldKey)}
                    onChange={() => toggle(field.fieldKey)}
                  />
                  <span>
                    <span className="font-medium">{field.label}</span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {field.supportsAppend
                        ? 'Supports append rules'
                        : 'Replace value with preview validation'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
