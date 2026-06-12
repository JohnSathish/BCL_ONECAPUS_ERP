'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchQuarter } from '@/services/accommodation';
import type { QuarterOccupancy } from '@/services/accommodation';
import {
  formatDate,
  formatInr,
  quarterTypeLabel,
  StatusBadge,
} from '@/components/hr-module/accommodation/accommodation-utils';

type Props = {
  quarterId: string | null;
  onClose: () => void;
  onVacate?: (occupancy: QuarterOccupancy) => void;
  onAllotNew?: (quarterId: string) => void;
};

export function AccommodationQuarterDetailDialog({
  quarterId,
  onClose,
  onVacate,
  onAllotNew,
}: Props) {
  const detailQ = useQuery({
    queryKey: ['accommodation', 'quarter', quarterId],
    queryFn: () => fetchQuarter(quarterId!),
    enabled: !!quarterId,
  });

  const q = detailQ.data as
    | {
        code?: string;
        quarterNumber?: string;
        quarterType?: string;
        block?: string | null;
        floor?: string | null;
        status?: string;
        monthlyRent?: number;
        waterCharge?: number;
        electricityCharge?: number;
        maintenanceCharge?: number;
        internetCharge?: number;
        remarks?: string | null;
        activeOccupant?: {
          fullName: string;
          employeeCode: string;
          department: string | null;
          allottedAt: string;
        } | null;
        occupancyHistory?: {
          id: string;
          status: string;
          staffProfileId?: string;
          staffName: string;
          employeeCode: string;
          allottedAt: string;
          vacatedAt: string | null;
          monthlyRent: number;
        }[];
      }
    | undefined;

  const activeHistory = q?.occupancyHistory?.find((h) => h.status === 'ACTIVE');

  const handleVacate = () => {
    if (!q || !activeHistory || !q.activeOccupant || !quarterId || !onVacate) return;
    onVacate({
      id: activeHistory.id,
      status: 'ACTIVE',
      quarter: {
        id: quarterId,
        code: q.code ?? '',
        quarterNumber: q.quarterNumber ?? '',
        quarterType: q.quarterType ?? '',
        block: q.block ?? null,
      },
      staffProfile: {
        id: activeHistory.staffProfileId ?? '',
        fullName: q.activeOccupant.fullName,
        employeeCode: q.activeOccupant.employeeCode,
        department: q.activeOccupant.department
          ? { id: '', name: q.activeOccupant.department }
          : null,
      },
      allottedAt: activeHistory.allottedAt,
      vacatedAt: null,
      monthlyRent: activeHistory.monthlyRent,
      waterCharge: Number(q.waterCharge ?? 0),
      electricityCharge: Number(q.electricityCharge ?? 0),
      maintenanceCharge: Number(q.maintenanceCharge ?? 0),
      internetCharge: Number(q.internetCharge ?? 0),
      payrollDeductionEnabled: true,
      notes: null,
      vacateNotes: null,
    });
  };

  return (
    <Dialog open={!!quarterId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{q?.code ?? 'Quarter details'}</DialogTitle>
          <DialogDescription>
            {q
              ? `${quarterTypeLabel(q.quarterType ?? '')} · ${q.block ?? 'No block'} · Room ${q.quarterNumber}`
              : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {detailQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading quarter details…</p>
        ) : q ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={q.status ?? 'VACANT'} />
              <span className="text-muted-foreground">
                Monthly rent {formatInr(Number(q.monthlyRent ?? 0))}
              </span>
            </div>

            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Floor</dt>
                <dd>{q.floor ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Water</dt>
                <dd>{formatInr(Number(q.waterCharge ?? 0))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Electricity</dt>
                <dd>{formatInr(Number(q.electricityCharge ?? 0))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Maintenance</dt>
                <dd>{formatInr(Number(q.maintenanceCharge ?? 0))}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Internet</dt>
                <dd>{formatInr(Number(q.internetCharge ?? 0))}</dd>
              </div>
              {q.remarks ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Remarks</dt>
                  <dd>{q.remarks}</dd>
                </div>
              ) : null}
            </dl>

            {q.activeOccupant ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Current occupant
                </p>
                <p className="mt-1 font-medium">{q.activeOccupant.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {q.activeOccupant.employeeCode} · {q.activeOccupant.department ?? '—'} · since{' '}
                  {formatDate(q.activeOccupant.allottedAt)}
                </p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Occupancy history
              </p>
              <div className="overflow-auto rounded-lg border border-border/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left uppercase text-muted-foreground">
                      <th className="px-2 py-1.5">Staff</th>
                      <th className="px-2 py-1.5">Allotted</th>
                      <th className="px-2 py-1.5">Vacated</th>
                      <th className="px-2 py-1.5">Rent</th>
                      <th className="px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(q.occupancyHistory ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">
                          No history yet
                        </td>
                      </tr>
                    ) : (
                      (q.occupancyHistory ?? []).map((h) => (
                        <tr key={h.id} className="border-b border-border/40">
                          <td className="px-2 py-1.5">{h.staffName}</td>
                          <td className="px-2 py-1.5">{formatDate(h.allottedAt)}</td>
                          <td className="px-2 py-1.5">{formatDate(h.vacatedAt)}</td>
                          <td className="px-2 py-1.5 tabular-nums">{formatInr(h.monthlyRent)}</td>
                          <td className="px-2 py-1.5">
                            <StatusBadge status={h.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {q ? (
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground sm:mr-auto">
              {q.status === 'OCCUPIED'
                ? 'Vacate the current occupant before allotting someone new.'
                : q.status === 'VACANT'
                  ? 'This quarter is ready for a new allotment.'
                  : 'Mark the quarter vacant before allotting.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {q.status === 'OCCUPIED' && activeHistory && onVacate ? (
                <Button variant="destructive" size="sm" onClick={handleVacate}>
                  Vacate current occupant
                </Button>
              ) : null}
              {q.status === 'VACANT' && onAllotNew && quarterId ? (
                <Button size="sm" onClick={() => onAllotNew(quarterId)}>
                  Allot new staff
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
