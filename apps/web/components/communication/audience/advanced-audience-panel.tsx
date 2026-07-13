'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, ChevronDown, Eraser, Eye, Loader2, Users, X } from 'lucide-react';

import { getAudiencePanelConfig } from '@/components/communication/audience/audience-filter-config';
import { AudienceFilterSections } from '@/components/communication/audience/audience-filter-sections';
import {
  compactAudienceFilter,
  EMPTY_AUDIENCE_FILTER,
  formatSemesterLabel,
  migrateLegacyAudience,
  resetFilterForAudience,
} from '@/components/communication/audience/audience-filter.utils';
import { AUDIENCE_OPTIONS } from '@/components/communication/comm-center-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createAudienceSegment,
  fetchAudienceContext,
  fetchAudienceSegments,
  previewCommunicationAudience,
  previewCommunicationAudienceCount,
} from '@/services/communication';
import { fetchGovernanceCommittees } from '@/services/governance';
import { fetchAcademicDepartments } from '@/services/organization';
import { fetchDesignations } from '@/services/staff';
import { fetchShifts } from '@/services/shifts';
import type { AudienceCountResult, AudienceFilter, ResolvedRecipient } from '@/types/communication';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Chip = { key: string; label: string; onRemove: () => void };

export type AdvancedAudiencePanelProps = {
  audienceType: string;
  filter: AudienceFilter;
  onAudienceTypeChange: (type: string) => void;
  onFilterChange: (next: AudienceFilter) => void;
  showSavedAudiences?: boolean;
  onUseInCompose?: (payload: {
    audienceType: string;
    filter: AudienceFilter;
    segmentId?: string;
  }) => void;
  className?: string;
  onCountChange?: (count: AudienceCountResult | null) => void;
};

export function AdvancedAudiencePanel({
  audienceType,
  filter,
  onAudienceTypeChange,
  onFilterChange,
  showSavedAudiences = true,
  onUseInCompose,
  className,
  onCountChange,
}: AdvancedAudiencePanelProps) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [segmentName, setSegmentName] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [count, setCount] = useState<AudienceCountResult | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);

  const panelConfig = getAudiencePanelConfig(audienceType);

  const context = useQuery({
    queryKey: ['communication', 'audience-context'],
    queryFn: fetchAudienceContext,
    enabled,
    staleTime: 60_000,
  });

  const departments = useQuery({
    queryKey: ['departments', 'academic', 'ACTIVE'],
    queryFn: () => fetchAcademicDepartments({ status: 'ACTIVE' }),
    enabled,
  });
  const shifts = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled,
  });
  const designations = useQuery({
    queryKey: ['staff', 'designations'],
    queryFn: () => fetchDesignations(),
    enabled: audienceType === 'FACULTY',
  });
  const committees = useQuery({
    queryKey: ['governance', 'committees', 'audience-chips'],
    queryFn: () => fetchGovernanceCommittees({ status: 'ACTIVE', limit: 200 }),
    enabled: audienceType === 'COMMITTEE',
  });
  const segments = useQuery({
    queryKey: ['communication', 'segments'],
    queryFn: fetchAudienceSegments,
    enabled: enabled && showSavedAudiences,
  });

  const compact = useMemo(() => {
    return compactAudienceFilter({
      ...filter,
      academicYearIds: undefined,
      semesterIds: undefined,
      programVersionIds: undefined,
    });
  }, [filter]);

  // Drop semester picks that are outside the active ODD/EVEN cycle (stale state / old segments).
  useEffect(() => {
    const allowed = context.data?.currentSemesterSequences;
    if (!allowed?.length) return;
    const current = filter.semesterSequences ?? [];
    if (!current.length) return;
    const next = current.filter((n) => allowed.includes(n));
    if (next.length === current.length) return;
    onFilterChange({ ...filter, semesterSequences: next, academicYearIds: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.data?.currentSemesterSequences]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCounting(true);
      setCountError(null);
      try {
        const result = await previewCommunicationAudienceCount({
          audienceType,
          audienceFilter: compact,
        });
        if (!cancelled) {
          setCount(result);
          onCountChange?.(result);
        }
      } catch (e) {
        if (!cancelled) {
          setCount(null);
          onCountChange?.(null);
          setCountError(apiErrorMessage(e, 'Could not count recipients'));
        }
      } finally {
        if (!cancelled) setCounting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceType, compact]);

  const preview = useMutation({
    mutationFn: () =>
      previewCommunicationAudience({
        audienceType,
        audienceFilter: compact,
      }),
  });

  const saveSegment = useMutation({
    mutationFn: () =>
      createAudienceSegment({
        name: segmentName.trim(),
        audienceType,
        filters: compact as Record<string, unknown>,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication', 'segments'] });
      setSegmentName('');
    },
  });

  function patch(partial: Partial<AudienceFilter>) {
    onFilterChange({ ...filter, ...partial, academicYearIds: undefined });
  }

  function clearAll() {
    onFilterChange(resetFilterForAudience(audienceType, EMPTY_AUDIENCE_FILTER));
  }

  function applySegment(segment: {
    id: string;
    audienceType: string;
    filters?: AudienceFilter | Record<string, unknown>;
  }) {
    const loaded = { ...(segment.filters as AudienceFilter) };
    delete loaded.academicYearIds;
    const migrated = migrateLegacyAudience(segment.audienceType, {
      ...EMPTY_AUDIENCE_FILTER,
      ...loaded,
    });
    onAudienceTypeChange(migrated.audienceType);
    onFilterChange(migrated.filter);
  }

  function changeAudienceType(next: string) {
    onAudienceTypeChange(next);
    onFilterChange(resetFilterForAudience(next, filter));
  }

  const selectedSequences = filter.semesterSequences ?? [];
  const selectedBatches = filter.admissionBatchIds ?? filter.batchIds ?? [];

  const chips: Chip[] = [];
  const deptMap = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  const designationMap = new Map((designations.data ?? []).map((d) => [d.id, d.label]));
  const committeeMap = new Map((committees.data?.items ?? []).map((c) => [c.id, c.name]));

  for (const id of filter.shiftIds ?? []) {
    const shift = (shifts.data ?? []).find((s) => s.id === id);
    chips.push({
      key: `shift-${id}`,
      label: shift?.name ?? 'Shift',
      onRemove: () => patch({ shiftIds: (filter.shiftIds ?? []).filter((x) => x !== id) }),
    });
  }
  for (const id of filter.departmentIds ?? []) {
    chips.push({
      key: `dept-${id}`,
      label: deptMap.get(id) ?? 'Department',
      onRemove: () =>
        patch({ departmentIds: (filter.departmentIds ?? []).filter((x) => x !== id) }),
    });
  }
  for (const n of selectedSequences) {
    chips.push({
      key: `sem-${n}`,
      label: formatSemesterLabel(n),
      onRemove: () => patch({ semesterSequences: selectedSequences.filter((x) => x !== n) }),
    });
  }
  for (const id of selectedBatches) {
    const batch = context.data?.admissionBatches.find((b) => b.id === id);
    chips.push({
      key: `batch-${id}`,
      label: batch?.label ?? 'Batch',
      onRemove: () =>
        patch({
          admissionBatchIds: selectedBatches.filter((x) => x !== id),
          batchIds: [],
        }),
    });
  }
  for (const id of filter.designationIds ?? []) {
    chips.push({
      key: `desig-${id}`,
      label: designationMap.get(id) ?? 'Designation',
      onRemove: () =>
        patch({ designationIds: (filter.designationIds ?? []).filter((x) => x !== id) }),
    });
  }
  for (const id of filter.committeeIds ?? []) {
    chips.push({
      key: `committee-${id}`,
      label: committeeMap.get(id) ?? 'Committee',
      onRemove: () => patch({ committeeIds: (filter.committeeIds ?? []).filter((x) => x !== id) }),
    });
  }
  if (filter.teaching) {
    chips.push({
      key: 'teaching',
      label: 'Teaching staff',
      onRemove: () => patch({ teaching: undefined }),
    });
  }
  if (filter.nonTeaching) {
    chips.push({
      key: 'nonTeaching',
      label: 'Non-teaching staff',
      onRemove: () => patch({ nonTeaching: undefined }),
    });
  }
  for (const status of filter.staffStatuses ?? []) {
    chips.push({
      key: `status-${status}`,
      label: status.replace(/_/g, ' '),
      onRemove: () =>
        patch({ staffStatuses: (filter.staffStatuses ?? []).filter((x) => x !== status) }),
    });
  }
  if (filter.gender) {
    chips.push({
      key: 'gender',
      label: `Gender: ${filter.gender}`,
      onRemove: () => patch({ gender: undefined }),
    });
  }
  if (filter.feeStatus) {
    chips.push({
      key: 'fee',
      label: `Fee: ${filter.feeStatus}`,
      onRemove: () => patch({ feeStatus: undefined }),
    });
  }
  if (filter.attendanceBelowPct != null) {
    chips.push({
      key: 'att-below',
      label: `Att < ${filter.attendanceBelowPct}%`,
      onRemove: () => patch({ attendanceBelowPct: undefined }),
    });
  }
  if (filter.residenceType) {
    chips.push({
      key: 'res',
      label: filter.residenceType.replace('_', ' '),
      onRemove: () => patch({ residenceType: undefined }),
    });
  }
  if ((filter.staffProfileIds ?? []).length) {
    chips.push({
      key: 'staff-include',
      label: `${(filter.staffProfileIds ?? []).length} staff included`,
      onRemove: () => patch({ staffProfileIds: [] }),
    });
  }
  if ((filter.studentIds ?? []).length) {
    chips.push({
      key: 'student-include',
      label: `${(filter.studentIds ?? []).length} students included`,
      onRemove: () => patch({ studentIds: [] }),
    });
  }

  const byType = count?.byAudienceType ?? {};
  const sessionLabel = context.data?.activeAcademicYear?.name ?? '—';
  const cycleLabel = context.data?.currentCycle ?? '—';

  return (
    <div className={className ?? 'space-y-4'}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Who should receive this?</h2>
          <p className="text-xs text-muted-foreground">{panelConfig.subtitle}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
          <Eraser className="mr-1 h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {panelConfig.showAcademicBanner ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-950 dark:text-sky-100">
          {context.isLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading academic context…
            </span>
          ) : context.isError ? (
            <span className="text-destructive">Could not load academic cycle context.</span>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  <span className="font-semibold">Active session:</span> {sessionLabel}
                </span>
                <span className="hidden text-sky-700/50 sm:inline dark:text-sky-300/50">|</span>
                <span>
                  <span className="font-semibold">Cycle:</span> {cycleLabel}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed opacity-85">
                Academic Year is college settings — not a student filter. Recipient counts use{' '}
                <span className="font-medium">current semester standing</span> (same engine as
                Student Directory).
              </p>
            </>
          )}
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Audience</label>
        <select
          className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
          value={audienceType}
          onChange={(e) => changeAudienceType(e.target.value)}
        >
          {AUDIENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {chips.length ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs"
            >
              {c.label}
              <X className="h-3 w-3 opacity-60" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-border/80 bg-card p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          Recipients found
          {counting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        </div>
        {countError ? (
          <p className="text-xs text-destructive">{countError}</p>
        ) : (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-2xl font-semibold tabular-nums">{count?.total ?? '—'}</span>
              <span className="ml-2 text-sm text-muted-foreground">{panelConfig.countLabel}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Students {byType.STUDENT ?? 0} · Staff {byType.FACULTY ?? 0} · Parents{' '}
              {byType.PARENT ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">
              Email {count?.withEmail ?? 0} · Mobile {count?.withPhone ?? 0} · Push{' '}
              {count?.withPush ?? 0}
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={preview.isPending}
          onClick={() => {
            setPreviewOpen(true);
            preview.mutate();
          }}
        >
          <Eye className="mr-1 h-3.5 w-3.5" />
          Preview list
        </Button>
      </div>

      <AudienceFilterSections
        sections={panelConfig.essentials}
        filter={filter}
        patch={patch}
        context={context.data}
        title="Essentials"
      />

      {panelConfig.more.length ? (
        <>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm font-medium hover:bg-muted/40"
            onClick={() => setShowMore((v) => !v)}
          >
            More filters
            <ChevronDown className={cn('h-4 w-4 transition', showMore && 'rotate-180')} />
          </button>
          {showMore ? (
            <AudienceFilterSections
              sections={panelConfig.more}
              filter={filter}
              patch={patch}
              context={context.data}
              className="border-dashed"
            />
          ) : null}
        </>
      ) : null}

      {previewOpen ? (
        <PreviewDialog
          loading={preview.isPending}
          error={preview.error ? apiErrorMessage(preview.error, 'Preview failed') : null}
          recipients={preview.data ?? []}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      {showSavedAudiences ? (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-sm font-medium">Saved audiences</p>
          {onUseInCompose ? (
            <Button
              type="button"
              className="w-full"
              variant="outline"
              size="sm"
              onClick={() => onUseInCompose({ audienceType, filter: compact })}
            >
              Use in Compose
            </Button>
          ) : null}
          <div className="flex gap-2">
            <Input
              placeholder="Name this audience"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!segmentName.trim() || saveSegment.isPending}
              onClick={() => saveSegment.mutate()}
            >
              <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
              Save
            </Button>
          </div>
          <ul className="max-h-36 space-y-1.5 overflow-y-auto">
            {(
              (segments.data as {
                id: string;
                name: string;
                audienceType: string;
                filters?: AudienceFilter;
              }[]) ?? []
            ).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.audienceType}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => applySegment(s)}>
                    Load
                  </Button>
                  {onUseInCompose ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const migrated = migrateLegacyAudience(s.audienceType, {
                          ...EMPTY_AUDIENCE_FILTER,
                          ...(s.filters as AudienceFilter),
                        });
                        onUseInCompose({
                          audienceType: migrated.audienceType,
                          filter: migrated.filter,
                          segmentId: s.id,
                        });
                      }}
                    >
                      Use
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PreviewDialog({
  loading,
  error,
  recipients,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  recipients: ResolvedRecipient[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h3 className="font-semibold">Preview ({recipients.length})</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 text-sm">
          {loading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : recipients.length === 0 ? (
            <p className="text-muted-foreground">No recipients matched.</p>
          ) : (
            <ul className="space-y-1.5">
              {recipients.slice(0, 200).map((r, i) => (
                <li key={`${r.userId ?? r.studentId ?? r.displayName}-${i}`} className="text-xs">
                  <span className="font-medium">{r.displayName}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {r.recipientType}
                    {r.email ? ` · ${r.email}` : ''}
                  </span>
                </li>
              ))}
              {recipients.length > 200 ? (
                <li className="text-muted-foreground">…and {recipients.length - 200} more</li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
