'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  assignFacultyToShift,
  searchFacultyShiftCandidates,
  type FacultyShiftCandidate,
} from '@/services/faculty-shifts';
import { cn } from '@/utils/cn';

type Props = {
  shiftId: string;
};

export function ShiftFacultyAssignPanel({ shiftId }: Props) {
  const authReady = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FacultyShiftCandidate | null>(null);
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const candidatesQ = useQuery({
    queryKey: ['faculty-shifts', 'candidates', shiftId, debouncedSearch],
    queryFn: () => searchFacultyShiftCandidates(shiftId, debouncedSearch),
    enabled: authReady && Boolean(shiftId) && debouncedSearch.trim().length >= 2,
  });

  const assignMutation = useMutation({
    mutationFn: assignFacultyToShift,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['faculty-shifts', shiftId] });
      await queryClient.invalidateQueries({ queryKey: ['faculty-shifts', 'candidates', shiftId] });
      setSearch('');
      setSelected(null);
      setHoursPerWeek('');
    },
  });

  const parsedHours = hoursPerWeek.trim() ? Number(hoursPerWeek) : undefined;
  const hoursValid =
    hoursPerWeek.trim() === '' ||
    (Number.isFinite(parsedHours) && parsedHours! > 0 && parsedHours! <= 60);

  function handleAssign() {
    if (!selected) return;
    assignMutation.mutate({
      facultyId: selected.id,
      shiftId,
      hoursPerWeek: parsedHours,
    });
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserPlus className="h-4 w-4 text-primary" />
        Assign staff to shift
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Search active staff by name or employee code. Already assigned staff are excluded.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Search staff
          <input
            className="block h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="Type at least 2 characters…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelected(null);
            }}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Hours / week
          <input
            className="block h-10 w-full rounded-md border bg-background px-3 text-sm lg:w-28"
            inputMode="decimal"
            placeholder="Optional"
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(e.target.value)}
          />
        </label>
        <Button
          type="button"
          disabled={!selected || !hoursValid || assignMutation.isPending}
          onClick={handleAssign}
        >
          {assignMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Assigning…
            </>
          ) : (
            'Assign'
          )}
        </Button>
      </div>

      {!hoursValid ? (
        <p className="mt-2 text-xs text-destructive">Hours must be between 1 and 60.</p>
      ) : null}
      {assignMutation.isError ? (
        <p className="mt-2 text-xs text-destructive">
          Could not assign staff. They may already be on this shift.
        </p>
      ) : null}

      {debouncedSearch.trim().length >= 2 ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
          {candidatesQ.isLoading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Searching…</p>
          ) : candidatesQ.data?.length ? (
            <ul className="divide-y">
              {candidatesQ.data.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-muted/40',
                      selected?.id === candidate.id && 'bg-primary/10',
                    )}
                    onClick={() => setSelected(candidate)}
                  >
                    <span>
                      <span className="font-medium">{candidate.fullName}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {candidate.shortCode ?? candidate.employeeCode} ·{' '}
                        {candidate.department?.name ?? 'No department'} · {candidate.staffType}
                      </span>
                    </span>
                    {selected?.id === candidate.id ? (
                      <span className="text-xs font-medium text-primary">Selected</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No matching staff found, or everyone matching is already assigned.
            </p>
          )}
        </div>
      ) : search.trim().length > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Keep typing to search staff.</p>
      ) : null}
    </section>
  );
}
