'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchBoardSubjects } from '@/services/support-data';
import { cn } from '@/utils/cn';

export type Class12SubjectValue = { name: string; code?: string };

type Props = {
  value: Class12SubjectValue[];
  onChange: (value: Class12SubjectValue[]) => void;
  boardStream?: string;
  disabled?: boolean;
  className?: string;
};

export function Class12SubjectMultiSelect({
  value,
  onChange,
  boardStream,
  disabled,
  className,
}: Props) {
  const [query, setQuery] = useState('');

  const subjectsQuery = useQuery({
    queryKey: ['support-data', 'board-subjects', 'class12'],
    queryFn: () => fetchBoardSubjects({ activeOnly: true }),
  });

  const selectedSlugs = useMemo(() => {
    const subjects = subjectsQuery.data ?? [];
    return new Set(
      value
        .map((item) => {
          const match = subjects.find(
            (s) => s.label.toLowerCase() === item.name.toLowerCase() || s.code === item.code,
          );
          return match?.code ?? item.name.toLowerCase().replace(/\s+/g, '-');
        })
        .filter(Boolean),
    );
  }, [value, subjectsQuery.data]);

  const filteredOptions = useMemo(() => {
    const options = subjectsQuery.data ?? [];
    const sorted = [...options].sort((a, b) => {
      const aPriority = streamPriority(a.metadata?.category, boardStream);
      const bPriority = streamPriority(b.metadata?.category, boardStream);
      return bPriority - aPriority || a.label.localeCompare(b.label);
    });
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (s) => s.label.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [subjectsQuery.data, query, boardStream]);

  const toggleSubject = (code: string, name: string) => {
    const existing = value.find(
      (item) => item.name.toLowerCase() === name.toLowerCase() || item.code === code,
    );
    if (existing) {
      onChange(
        value.filter(
          (item) => item.name.toLowerCase() !== name.toLowerCase() && item.code !== code,
        ),
      );
      return;
    }
    onChange([...value, { name, code }]);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">No Class XII subjects selected</span>
        ) : (
          value.map((item, index) => (
            <span
              key={`${item.name}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
            >
              {item.name}
              {!disabled ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => removeAt(index)}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))
        )}
      </div>
      {!disabled ? (
        <>
          <input
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            placeholder="Search academic subjects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
            {subjectsQuery.isLoading ? (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">Loading subjects…</li>
            ) : filteredOptions.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">No subjects found</li>
            ) : (
              filteredOptions.map((subject) => {
                const selected = selectedSlugs.has(subject.code);
                return (
                  <li key={subject.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-muted/50',
                        selected && 'bg-primary/10',
                      )}
                      onClick={() => toggleSubject(subject.code, subject.label)}
                    >
                      <span>{subject.label}</span>
                      <span className="text-xs text-muted-foreground">{subject.code}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function streamPriority(category: unknown, stream?: string) {
  const normalizedCategory = String(category ?? '').toUpperCase();
  const normalizedStream = String(stream ?? '').toUpperCase();
  if (!normalizedStream) return 0;
  if (normalizedCategory === normalizedStream) return 2;
  if (normalizedCategory === 'LANGUAGE' || normalizedCategory === 'GENERAL') return 1;
  return 0;
}
