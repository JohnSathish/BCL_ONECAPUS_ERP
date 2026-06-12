'use client';

import Link from 'next/link';
import { SectionCard } from '@/components/student-profile/student-profile-shell';
import { buttonVariants } from '@/components/ui/button';
import type { StaffProfile } from '@/types/staff';
import { cn } from '@/utils/cn';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function StaffAccommodationSection({ profile }: { profile: StaffProfile }) {
  const acc = profile.accommodation;
  const active = acc?.active;

  return (
    <div className="space-y-3">
      <SectionCard
        title="Accommodation Information"
        description="Staff quarters allotment and occupancy"
      >
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Accommodation Status</dt>
            <dd className="font-medium">
              {acc?.status === 'OCCUPIED' ? 'Occupied' : 'Not allotted'}
            </dd>
          </div>
          {active ? (
            <>
              <div>
                <dt className="text-muted-foreground">Quarter Number</dt>
                <dd className="font-medium font-mono">{active.quarterNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Quarter Type</dt>
                <dd className="font-medium">{active.quarterType.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Building</dt>
                <dd className="font-medium">{active.building ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Allotted Date</dt>
                <dd className="font-medium">{formatDate(active.allottedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Monthly Rent</dt>
                <dd className="font-medium">{formatInr(active.monthlyRent)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Additional Charges</dt>
                <dd className="font-medium">
                  Water {formatInr(active.waterCharge)} · Elec {formatInr(active.electricityCharge)}{' '}
                  · Maint {formatInr(active.maintenanceCharge)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payroll Deduction</dt>
                <dd className="font-medium">
                  {active.payrollDeductionEnabled ? 'Enabled' : 'Disabled'}
                </dd>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">No active quarter allotment.</p>
              <Link
                href="/admin/hr/accommodation"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'mt-2 h-7 text-xs',
                )}
              >
                Open Accommodation Module
              </Link>
            </div>
          )}
        </dl>
      </SectionCard>

      {(acc?.history ?? []).length > 0 ? (
        <SectionCard title="Accommodation History" description="Permanent occupancy records">
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Quarter</th>
                  <th className="py-2 pr-2">Allotted</th>
                  <th className="py-2 pr-2">Vacated</th>
                  <th className="py-2 pr-2">Rent</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(acc?.history ?? []).map((h) => (
                  <tr key={h.id} className="border-b border-border/40">
                    <td className="py-2 pr-2 font-mono">{h.quarterNumber}</td>
                    <td className="py-2 pr-2">{formatDate(h.allottedAt)}</td>
                    <td className="py-2 pr-2">{h.vacatedAt ? formatDate(h.vacatedAt) : '—'}</td>
                    <td className="py-2 pr-2 tabular-nums">{formatInr(h.monthlyRent)}</td>
                    <td className="py-2">{h.status === 'ACTIVE' ? 'Active' : 'Completed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
