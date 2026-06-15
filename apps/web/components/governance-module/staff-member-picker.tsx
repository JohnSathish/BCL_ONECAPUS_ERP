'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchStaff } from '@/services/staff';
import type { StaffListItem } from '@/types/staff';
import type { GovernanceImportDraftMember } from '@/types/governance';
import { cn } from '@/utils/cn';

export function staffMemberToDraftPatch(
  staff: StaffListItem,
): Partial<GovernanceImportDraftMember> {
  return {
    displayName: staff.fullName,
    employeeCode: staff.employeeCode,
    staffProfileId: staff.id,
    email: staff.email ?? undefined,
    mobile: staff.mobile ?? undefined,
    designation: staff.designation ?? undefined,
    isExternal: false,
    staffMatchConfidence: 1,
  };
}

export function StaffMemberPicker({
  member,
  onChange,
}: {
  member: GovernanceImportDraftMember;
  onChange: (patch: Partial<GovernanceImportDraftMember>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(member.displayName ?? '');
  const debounced = useDebouncedValue(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchQ = useQuery({
    queryKey: ['staff', 'governance-import-search', debounced],
    queryFn: () => fetchStaff({ search: debounced, limit: 8, status: 'ACTIVE' }),
    enabled: open && debounced.trim().length >= 2,
  });

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const results = searchQ.data?.data ?? [];

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search staff by name or code"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
        <Button
          type="button"
          variant={member.isExternal ? 'secondary' : 'outline'}
          size="sm"
          onClick={() =>
            onChange({
              isExternal: true,
              staffProfileId: null,
              userId: null,
              staffMatchConfidence: undefined,
            })
          }
        >
          <UserX className="mr-1 h-3.5 w-3.5" />
          External
        </Button>
        {member.staffProfileId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                staffProfileId: null,
                userId: null,
                staffMatchConfidence: undefined,
                isExternal: false,
              })
            }
          >
            Clear link
          </Button>
        ) : null}
      </div>

      {open && debounced.trim().length >= 2 ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full min-w-[280px] overflow-auto rounded-md border bg-popover shadow-md">
          {searchQ.isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : null}
          {!searchQ.isLoading && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No staff found. Mark as external if not in ERP.
            </p>
          ) : null}
          {results.map((staff) => (
            <button
              key={staff.id}
              type="button"
              className={cn(
                'flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60',
                member.staffProfileId === staff.id && 'bg-primary/5',
              )}
              onClick={() => {
                onChange(staffMemberToDraftPatch(staff));
                setQuery(staff.fullName);
                setOpen(false);
              }}
            >
              <span className="flex items-center gap-1 font-medium">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                {staff.fullName}
              </span>
              <span className="text-xs text-muted-foreground">
                {staff.employeeCode}
                {staff.department ? ` · ${staff.department}` : ''}
                {staff.designation ? ` · ${staff.designation}` : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
