'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AUDIENCE_OPTIONS } from '@/components/communication/comm-center-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createAudienceSegment,
  fetchAudienceSegments,
  previewCommunicationAudience,
} from '@/services/communication';
import { fetchDepartments } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';

export function AudienceBuilder() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [segmentName, setSegmentName] = useState('');
  const [filters, setFilters] = useState({
    audienceType: 'STUDENTS',
    departmentIds: [] as string[],
    shiftIds: [] as string[],
    gender: '',
    feeDue: false,
    defaulters: false,
    attendanceBelowPct: '' as string | number,
  });

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => fetchDepartments(),
    enabled,
  });

  const segments = useQuery({
    queryKey: ['communication', 'segments'],
    queryFn: fetchAudienceSegments,
    enabled,
  });

  const preview = useMutation({
    mutationFn: () =>
      previewCommunicationAudience({
        audienceType: filters.audienceType,
        audienceFilter: {
          departmentIds: filters.departmentIds,
          shiftIds: filters.shiftIds.length ? filters.shiftIds : undefined,
          gender: filters.gender || undefined,
          feeDue: filters.feeDue || undefined,
          defaulters: filters.defaulters || undefined,
          attendanceBelowPct: filters.attendanceBelowPct
            ? Number(filters.attendanceBelowPct)
            : undefined,
        },
      }),
  });

  const saveSegment = useMutation({
    mutationFn: () =>
      createAudienceSegment({
        name: segmentName,
        audienceType: filters.audienceType,
        filters: {
          departmentIds: filters.departmentIds,
          shiftIds: filters.shiftIds,
          gender: filters.gender,
          feeDue: filters.feeDue,
          defaulters: filters.defaulters,
          attendanceBelowPct: filters.attendanceBelowPct
            ? Number(filters.attendanceBelowPct)
            : undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication', 'segments'] });
      setSegmentName('');
    },
    onError: (e) => alert(apiErrorMessage(e, 'Failed to save segment')),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5">
        <h2 className="font-semibold">Audience Filters</h2>
        <div>
          <label className="text-sm font-medium">Audience type</label>
          <select
            className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
            value={filters.audienceType}
            onChange={(e) => setFilters((f) => ({ ...f, audienceType: e.target.value }))}
          >
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Departments</label>
          <select
            multiple
            className="mt-1 h-28 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
            value={filters.departmentIds}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                departmentIds: Array.from(e.target.selectedOptions, (o) => o.value),
              }))
            }
          >
            {(departments.data ?? []).map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Gender</label>
          <select
            className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
            value={filters.gender}
            onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}
          >
            <option value="">Any</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Attendance below %</label>
          <Input
            type="number"
            placeholder="e.g. 75"
            value={filters.attendanceBelowPct}
            onChange={(e) => setFilters((f) => ({ ...f, attendanceBelowPct: e.target.value }))}
          />
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.feeDue}
              onChange={(e) => setFilters((f) => ({ ...f, feeDue: e.target.checked }))}
            />
            Fee due
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.defaulters}
              onChange={(e) => setFilters((f) => ({ ...f, defaulters: e.target.checked }))}
            />
            Fee defaulters
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => preview.mutate()} disabled={preview.isPending}>
            Preview ({preview.data?.length ?? '…'} recipients)
          </Button>
          <Input
            placeholder="Segment name"
            value={segmentName}
            onChange={(e) => setSegmentName(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!segmentName || saveSegment.isPending}
            onClick={() => saveSegment.mutate()}
          >
            Save segment
          </Button>
        </div>
        {preview.data?.length ? (
          <ul className="max-h-40 overflow-y-auto text-xs text-muted-foreground">
            {preview.data.slice(0, 20).map((r, i) => (
              <li key={i}>
                {r.displayName} {r.email ? `· ${r.email}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-5">
        <h2 className="font-semibold">Saved Segments</h2>
        <div className="mt-3 space-y-2">
          {((segments.data as { id: string; name: string; audienceType: string }[]) ?? []).map(
            (s) => (
              <div key={s.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.audienceType}</p>
              </div>
            ),
          )}
          {!segments.data?.length ? (
            <p className="text-sm text-muted-foreground">No saved segments yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
