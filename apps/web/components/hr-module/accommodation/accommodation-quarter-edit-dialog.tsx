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
import type { StaffQuarter } from '@/services/accommodation';
import { Field, inputClass } from '@/components/hr-module/accommodation/accommodation-utils';

type QuarterType = { slug: string; name: string };

type Props = {
  open: boolean;
  quarter: StaffQuarter | null;
  quarterTypes: QuarterType[];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
  isPending?: boolean;
};

export function AccommodationQuarterEditDialog({
  open,
  quarter,
  quarterTypes,
  onClose,
  onSave,
  isPending,
}: Props) {
  const [form, setForm] = useState({
    quarterNumber: '',
    quarterType: 'FACULTY',
    block: '',
    floor: '',
    numberOfRooms: 2,
    monthlyRent: 500,
    waterCharge: 100,
    electricityCharge: 250,
    maintenanceCharge: 150,
    internetCharge: 0,
    remarks: '',
    status: 'VACANT',
  });

  useEffect(() => {
    if (!quarter) return;
    setForm({
      quarterNumber: quarter.quarterNumber,
      quarterType: quarter.quarterType,
      block: quarter.block ?? '',
      floor: quarter.floor ?? '',
      numberOfRooms: quarter.numberOfRooms ?? 2,
      monthlyRent: quarter.monthlyRent,
      waterCharge: quarter.waterCharge,
      electricityCharge: quarter.electricityCharge,
      maintenanceCharge: quarter.maintenanceCharge,
      internetCharge: quarter.internetCharge,
      remarks: quarter.remarks ?? '',
      status: quarter.status,
    });
  }, [quarter]);

  if (!quarter) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quarter — {quarter.code}</DialogTitle>
          <DialogDescription>Update quarter details and standard charges.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Field label="Quarter number" className="sm:col-span-2">
            <input
              className={inputClass()}
              value={form.quarterNumber}
              onChange={(e) => setForm({ ...form, quarterNumber: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputClass()}
              value={form.quarterType}
              onChange={(e) => setForm({ ...form, quarterType: e.target.value })}
            >
              {quarterTypes.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={inputClass()}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              disabled={quarter.status === 'OCCUPIED'}
            >
              <option value="VACANT">Vacant</option>
              <option value="RESERVED">Reserved</option>
              <option value="MAINTENANCE">Maintenance</option>
              {quarter.status === 'OCCUPIED' ? <option value="OCCUPIED">Occupied</option> : null}
            </select>
          </Field>
          <Field label="Block">
            <input
              className={inputClass()}
              value={form.block}
              onChange={(e) => setForm({ ...form, block: e.target.value })}
            />
          </Field>
          <Field label="Floor">
            <input
              className={inputClass()}
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            />
          </Field>
          <Field label="Rooms">
            <input
              type="number"
              className={inputClass()}
              value={form.numberOfRooms}
              onChange={(e) => setForm({ ...form, numberOfRooms: Number(e.target.value) })}
            />
          </Field>
          <Field label="Monthly rent">
            <input
              type="number"
              className={inputClass()}
              value={form.monthlyRent}
              onChange={(e) => setForm({ ...form, monthlyRent: Number(e.target.value) })}
            />
          </Field>
          <Field label="Water charge">
            <input
              type="number"
              className={inputClass()}
              value={form.waterCharge}
              onChange={(e) => setForm({ ...form, waterCharge: Number(e.target.value) })}
            />
          </Field>
          <Field label="Electricity charge">
            <input
              type="number"
              className={inputClass()}
              value={form.electricityCharge}
              onChange={(e) => setForm({ ...form, electricityCharge: Number(e.target.value) })}
            />
          </Field>
          <Field label="Maintenance charge">
            <input
              type="number"
              className={inputClass()}
              value={form.maintenanceCharge}
              onChange={(e) => setForm({ ...form, maintenanceCharge: Number(e.target.value) })}
            />
          </Field>
          <Field label="Internet charge">
            <input
              type="number"
              className={inputClass()}
              value={form.internetCharge}
              onChange={(e) => setForm({ ...form, internetCharge: Number(e.target.value) })}
            />
          </Field>
          <Field label="Remarks" className="sm:col-span-2">
            <textarea
              className={inputClass()}
              rows={2}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </Field>
        </div>

        {quarter.activeOccupant ? (
          <p className="text-xs text-muted-foreground">
            Occupied by {quarter.activeOccupant.fullName}. Rent changes affect new allotments;
            active occupancy keeps original rates until revised.
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button disabled={isPending || !form.quarterNumber} onClick={() => onSave(form)}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
