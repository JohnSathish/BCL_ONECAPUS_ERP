'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

export type FilterOption = { id: string; label: string };

type FilterPillProps = {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  className?: string;
};

export function FilterPill({
  label,
  value,
  options,
  onChange,
  searchable,
  className,
}: FilterPillProps) {
  const [query, setQuery] = useState('');
  const active = Boolean(value);
  const selectedLabel = options.find((o) => o.id === value)?.label;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery('')}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'h-8 rounded-full border-border/60 bg-background/60 px-3 text-xs font-medium',
            active && 'ring-1 ring-primary/40 shadow-[var(--shadow-glow)]',
            className,
          )}
        >
          {active ? (selectedLabel ?? label) : label}
          <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 p-1">
        {searchable ? (
          <div className="relative px-1 pb-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="h-8 w-full rounded-md border border-border/60 bg-background pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-primary/30"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        ) : null}
        <DropdownMenuItem className="text-xs" onClick={() => onChange('')}>
          {!value ? <Check className="mr-2 h-3.5 w-3.5" /> : <span className="mr-2 w-3.5" />}
          All
        </DropdownMenuItem>
        {filtered.map((o) => (
          <DropdownMenuItem key={o.id} className="text-xs" onClick={() => onChange(o.id)}>
            {value === o.id ? (
              <Check className="mr-2 h-3.5 w-3.5" />
            ) : (
              <span className="mr-2 w-3.5" />
            )}
            <span className="truncate">{o.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type FilterPillMultiProps = {
  label: string;
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  renderOptionLabel?: (option: FilterOption, selected: boolean) => React.ReactNode;
  className?: string;
};

export function FilterPillMulti({
  label,
  values,
  options,
  onChange,
  searchable,
  renderOptionLabel,
  className,
}: FilterPillMultiProps) {
  const [query, setQuery] = useState('');
  const active = values.length > 0;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const triggerLabel = active
    ? values.length === 1
      ? (options.find((o) => o.id === values[0])?.label ?? `${values.length} selected`)
      : `${label} (${values.length})`
    : label;

  const toggle = (id: string) => {
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery('')}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'h-8 rounded-full border-border/60 bg-background/60 px-3 text-xs font-medium',
            active && 'ring-1 ring-primary/40 shadow-[var(--shadow-glow)]',
            className,
          )}
        >
          {triggerLabel}
          <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto p-1">
        {searchable ? (
          <div className="relative px-1 pb-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="h-8 w-full rounded-md border border-border/60 bg-background pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-primary/30"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        ) : null}
        <DropdownMenuItem className="text-xs" onClick={() => onChange([])}>
          {!active ? <Check className="mr-2 h-3.5 w-3.5" /> : <span className="mr-2 w-3.5" />}
          All
        </DropdownMenuItem>
        {filtered.map((o) => {
          const selected = values.includes(o.id);
          return (
            <DropdownMenuItem
              key={o.id}
              className="text-xs"
              onClick={(e) => {
                e.preventDefault();
                toggle(o.id);
              }}
            >
              {selected ? (
                <Check className="mr-2 h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="mr-2 w-3.5 shrink-0" />
              )}
              {renderOptionLabel ? (
                renderOptionLabel(o, selected)
              ) : (
                <span className="truncate">{o.label}</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
