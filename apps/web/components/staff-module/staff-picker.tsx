'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchStaff, fetchStaffMember } from '@/services/staff';
import type { StaffListItem } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export type StaffPickerProps = {
  value: string;
  onChange: (staffId: string, staff: StaffListItem | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  status?: string;
  className?: string;
};

function StaffSelectedCard({
  staff,
  onClear,
  disabled,
}: {
  staff: StaffListItem;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
        {staff.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staff.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          staff.fullName.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{staff.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {staff.employeeCode}
          {staff.department ? ` · ${staff.department}` : ''}
          {staff.designation ? ` · ${staff.designation}` : ''}
        </p>
      </div>
      {!disabled ? (
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClear}
          aria-label="Clear staff selection"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function StaffPicker({
  value,
  onChange,
  label = 'Staff',
  placeholder = 'Search by name, employee code, or mobile…',
  required,
  disabled,
  status = 'ACTIVE',
  className,
}: StaffPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedStaff, setSelectedStaff] = useState<StaffListItem | null>(null);

  const staffQ = useQuery({
    queryKey: ['staff-picker', debouncedSearch, status],
    queryFn: async () => {
      const res = await fetchStaff({
        search: debouncedSearch.trim(),
        limit: 12,
        status,
      });
      return res.data;
    },
    enabled: debouncedSearch.trim().length >= 2,
  });

  const valueStaffQ = useQuery({
    queryKey: ['staff-picker', 'value', value],
    queryFn: () => fetchStaffMember(value),
    enabled: Boolean(value) && (!selectedStaff || selectedStaff.id !== value),
  });

  useEffect(() => {
    if (valueStaffQ.data) {
      setSelectedStaff(valueStaffQ.data);
      setSearch(valueStaffQ.data.fullName);
    }
  }, [valueStaffQ.data]);

  useEffect(() => {
    if (!value) {
      setSelectedStaff(null);
      setSearch('');
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearSelection = () => {
    setSelectedStaff(null);
    setSearch('');
    onChange('', null);
  };

  const selectStaff = (staff: StaffListItem) => {
    setSelectedStaff(staff);
    setSearch(staff.fullName);
    setShowResults(false);
    onChange(staff.id, staff);
  };

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      <label className="block text-xs font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm disabled:opacity-60"
            placeholder={placeholder}
            value={search}
            disabled={disabled}
            required={required && !value}
            onChange={(event) => {
              const next = event.target.value;
              setSearch(next);
              setShowResults(true);
              if (!next.trim()) {
                clearSelection();
              } else if (selectedStaff && next !== selectedStaff.fullName) {
                setSelectedStaff(null);
                onChange('', null);
              }
            }}
            onFocus={() => setShowResults(true)}
          />
          {showResults && search.trim().length >= 2 ? (
            <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-border bg-popover shadow-lg">
              {staffQ.isLoading || search !== debouncedSearch ? (
                <p className="p-3 text-xs text-muted-foreground">Searching staff…</p>
              ) : staffQ.isError ? (
                <p className="p-3 text-xs text-destructive">
                  {apiErrorMessage(staffQ.error, 'Staff search failed')}
                </p>
              ) : (staffQ.data ?? []).length ? (
                (staffQ.data ?? []).map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectStaff(staff)}
                    className={cn(
                      'flex w-full flex-col border-b border-border/60 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted/60',
                      value === staff.id && 'bg-primary/5',
                    )}
                  >
                    <span className="font-medium">{staff.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {staff.employeeCode}
                      {staff.department ? ` · ${staff.department}` : ''}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-3 text-xs text-muted-foreground">
                  No staff found for &ldquo;{debouncedSearch}&rdquo;
                </p>
              )}
            </div>
          ) : search.trim().length > 0 && search.trim().length < 2 ? (
            <p className="mt-1 text-xs text-muted-foreground">Type at least 2 characters…</p>
          ) : null}
        </div>
      </label>
      {selectedStaff ? (
        <StaffSelectedCard staff={selectedStaff} onClear={clearSelection} disabled={disabled} />
      ) : null}
    </div>
  );
}
