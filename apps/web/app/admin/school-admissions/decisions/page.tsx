'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { SchoolOfficeStatusBadge } from '@/components/school-office/status-badge';
import { SchoolOfficeWorkQueueTable } from '@/components/school-office/work-queue-table';
import { fetchSchoolOfficeApplications } from '@/services/school-admissions';

type DecisionMode = 'ready' | 'granted' | 'not_granted';

export default function SchoolAdmissionDecisionsPage() {
  const enabled = useAuthQueryEnabled();
  const [mode, setMode] = useState<DecisionMode>('ready');

  const list = useQuery({
    queryKey: ['school-office-decisions', mode],
    queryFn: () =>
      fetchSchoolOfficeApplications({
        decisionQueue: mode,
        limit: 100,
      }),
    enabled,
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--school-erp-muted)]">
          Admission Decisions
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--school-erp-primary)]">
          Admission Review Queue
        </h1>
        <p className="mt-1 text-sm text-[var(--school-erp-muted)]">
          Final grant / refuse decisions after payment and documents are verified.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['ready', 'Ready for Review'],
            ['granted', 'Granted'],
            ['not_granted', 'Not Granted'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={mode === value ? 'default' : 'outline'}
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <SchoolOfficeWorkQueueTable
        columns={[
          { key: 'appNo', header: 'Application No.' },
          { key: 'name', header: 'Candidate' },
          { key: 'category', header: 'Category' },
          { key: 'payment', header: 'Payment' },
          { key: 'docs', header: 'Documents' },
          { key: 'index', header: 'Index No.' },
          { key: 'action', header: 'Action' },
        ]}
        rows={(list.data?.data ?? []).map((app) => ({
          id: app.id,
          cells: {
            appNo: app.applicationNumber,
            name: app.childName || app.firstName,
            category: app.categoryLabel || '—',
            payment: (
              <SchoolOfficeStatusBadge
                label={app.paymentStatus === 'PAID' ? 'Verified' : app.paymentStatus}
                tone={app.paymentStatus === 'PAID' ? 'success' : 'warning'}
              />
            ),
            docs: (
              <SchoolOfficeStatusBadge
                label={app.documentRollup?.allRequiredVerified ? 'Verified' : 'Pending'}
                tone={app.documentRollup?.allRequiredVerified ? 'success' : 'warning'}
              />
            ),
            index: app.indexNumber || '—',
            action: (
              <Button asChild size="sm">
                <Link href={`/admin/school-admissions/${app.id}?tab=review`}>
                  Review &amp; Decide
                </Link>
              </Button>
            ),
          },
        }))}
        emptyMessage={list.isLoading ? 'Loading…' : 'No applications in this queue.'}
      />
    </div>
  );
}
