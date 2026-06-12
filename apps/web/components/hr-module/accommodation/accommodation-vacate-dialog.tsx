'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { QuarterOccupancy } from '@/services/accommodation';
import {
  Field,
  formatDate,
  formatInr,
  inputClass,
} from '@/components/hr-module/accommodation/accommodation-utils';

type Props = {
  open: boolean;
  occupancy: QuarterOccupancy | null;
  onClose: () => void;
  onConfirm: (payload: {
    vacatedAt: string;
    finalMeterReading?: string;
    finalCharges?: number;
    remarks?: string;
  }) => void;
  isPending?: boolean;
};

export function AccommodationVacateDialog({
  open,
  occupancy,
  onClose,
  onConfirm,
  isPending,
}: Props) {
  const [vacatedAt, setVacatedAt] = useState('');
  const [finalMeterReading, setFinalMeterReading] = useState('');
  const [finalCharges, setFinalCharges] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!open || !occupancy) return;
    setVacatedAt(new Date().toISOString().slice(0, 10));
    setFinalMeterReading('');
    setFinalCharges('');
    setRemarks('');
  }, [open, occupancy?.id]);

  if (!occupancy) return null;

  const monthlyTotal =
    occupancy.monthlyRent +
    occupancy.waterCharge +
    occupancy.electricityCharge +
    occupancy.maintenanceCharge +
    occupancy.internetCharge;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vacate Quarter</DialogTitle>
          <DialogDescription>
            {occupancy.staffProfile.fullName} — {occupancy.quarter.code} (
            {occupancy.quarter.block ?? 'N/A'})
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Payroll deductions will stop after vacate.
          </p>
          <p className="mt-1 text-muted-foreground">
            Allotted {formatDate(occupancy.allottedAt)} · Standard monthly charges{' '}
            {formatInr(monthlyTotal)}
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <Field label="Vacated date *">
            <input
              type="date"
              className={inputClass()}
              value={vacatedAt}
              onChange={(e) => setVacatedAt(e.target.value)}
            />
          </Field>
          <Field label="Final meter reading">
            <input
              className={inputClass()}
              placeholder="e.g. Electricity 4521 kWh"
              value={finalMeterReading}
              onChange={(e) => setFinalMeterReading(e.target.value)}
            />
          </Field>
          <Field label="Final settlement charges (₹)">
            <input
              type="number"
              min={0}
              className={inputClass()}
              placeholder="0"
              value={finalCharges}
              onChange={(e) => setFinalCharges(e.target.value)}
            />
          </Field>
          <Field label="Remarks">
            <textarea
              className={inputClass()}
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!vacatedAt || isPending}
            onClick={() =>
              onConfirm({
                vacatedAt,
                finalMeterReading: finalMeterReading.trim() || undefined,
                finalCharges: finalCharges ? Number(finalCharges) : undefined,
                remarks: remarks.trim() || undefined,
              })
            }
          >
            Confirm Vacate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
