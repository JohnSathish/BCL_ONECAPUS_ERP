'use client';

import { Button } from '@/components/ui/button';
import type { OfferingSection } from '@/types/programs';
import type { CurriculumOfferingRow } from '@/types/curriculum-filters';
import { formatCurriculumMetaLine, isSharedPoolOffering } from '@/utils/curriculum-offering-meta';
import { formatEligibleStreamsLabel } from '@/utils/section-stream-label';

type Props = {
  rows: CurriculumOfferingRow[];
  canManage: boolean;
  streamCount: number;
  showSemesterGroups: boolean;
  onEditMapping: (offering: CurriculumOfferingRow) => void;
  onDeleteMapping: (offering: CurriculumOfferingRow) => void;
  onEditSection: (offering: CurriculumOfferingRow, section: OfferingSection) => void;
  onDeleteSection: (offering: CurriculumOfferingRow, section: OfferingSection) => void;
  deleteOfferingPending: boolean;
  deleteSectionPending: boolean;
  createSectionPending: boolean;
  updateSectionPending: boolean;
};

function facultyEmail(section: OfferingSection): string | null {
  const legacy = section.faculty?.user?.email;
  if (legacy) return legacy;
  const profile = (
    section as OfferingSection & { staffProfile?: { portalUser?: { email?: string } } }
  ).staffProfile;
  return profile?.portalUser?.email ?? null;
}

export function CurriculumDeliveryList({
  rows,
  canManage,
  streamCount,
  showSemesterGroups,
  onEditMapping,
  onDeleteMapping,
  onEditSection,
  onDeleteSection,
  deleteOfferingPending,
  deleteSectionPending,
  createSectionPending,
  updateSectionPending,
}: Props) {
  return (
    <div className="space-y-3">
      {rows.map((o, idx) => {
        const prev = rows[idx - 1];
        const showSemesterGroup =
          showSemesterGroups &&
          o.semesterSequence != null &&
          o.semesterSequence >= 1 &&
          o.semesterSequence !== prev?.semesterSequence;

        return (
          <div key={o.id}>
            {showSemesterGroup ? (
              <h3 className="-mb-1 mt-4 text-sm font-semibold text-foreground first:mt-0">
                Semester {o.semesterSequence}
              </h3>
            ) : null}
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {o.course.code} — {o.course.title}
                    </p>
                    {o.semesterSequence != null && o.semesterSequence >= 1 ? (
                      <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        Semester {o.semesterSequence}
                      </span>
                    ) : null}
                    {o.mappingStatus ? (
                      <span className="rounded-md border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {o.mappingStatus}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatCurriculumMetaLine(o)}
                  </p>
                </div>
                {canManage && !isSharedPoolOffering(o) ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onEditMapping(o)}
                    >
                      Edit mapping
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deleteOfferingPending}
                      onClick={() => onDeleteMapping(o)}
                    >
                      Remove mapping
                    </Button>
                  </div>
                ) : isSharedPoolOffering(o) ? (
                  <p className="text-xs text-muted-foreground">
                    Managed in Academic Engine → Shared category pools
                  </p>
                ) : null}
              </div>
              {(o.sections ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No delivery sections — add one in the form (left).
                </p>
              ) : (
                <ul className="space-y-2 pl-2">
                  {(o.sections ?? []).map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-mono font-medium">{s.sectionCode}</span>
                        {` · ${formatEligibleStreamsLabel(s.eligibleStreams, streamCount)}`}
                        {s.shift ? ` · ${s.shift.code}` : ''}
                        {facultyEmail(s) ? ` · ${facultyEmail(s)}` : ''}
                        <span className="text-muted-foreground">
                          {' '}
                          · cap {s.capacity}
                          {s.seatLedger ? ` (${s.seatLedger.confirmedCount} enrolled)` : ''}
                        </span>
                      </span>
                      {canManage ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            disabled={
                              deleteSectionPending || createSectionPending || updateSectionPending
                            }
                            onClick={() => onEditSection(o, s)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive"
                            disabled={deleteSectionPending}
                            onClick={() => onDeleteSection(o, s)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
