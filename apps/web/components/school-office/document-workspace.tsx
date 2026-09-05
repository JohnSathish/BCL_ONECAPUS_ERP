'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { SchoolOfficeStatusBadge } from '@/components/school-office/status-badge';
import { SchoolOfficeWorkQueueTable } from '@/components/school-office/work-queue-table';
import { fetchSchoolOfficeApplications } from '@/services/school-admissions';

export type DocumentQueueMode = 'pending' | 'verified' | 'rejected';

export function SchoolDocumentWorkspace({ mode }: { mode: DocumentQueueMode }) {
  const enabled = useAuthQueryEnabled();
  const list = useQuery({
    queryKey: ['school-office-documents', mode],
    queryFn: () =>
      fetchSchoolOfficeApplications({
        documentVerification: mode,
        limit: 100,
      }),
    enabled,
  });

  const title =
    mode === 'pending'
      ? 'Document Verification Queue'
      : mode === 'verified'
        ? 'Verified Documents'
        : 'Rejected Documents';

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--school-erp-muted)]">
          Documents
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--school-erp-primary)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--school-erp-muted)]">
          Work through certificate verification without opening every applicant manually.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/school-admissions/documents/pending" className="underline">
            Verification Queue
          </Link>
          <Link href="/admin/school-admissions/documents/verified" className="underline">
            Verified
          </Link>
          <Link href="/admin/school-admissions/documents/rejected" className="underline">
            Rejected
          </Link>
        </div>
      </div>

      <SchoolOfficeWorkQueueTable
        columns={[
          { key: 'appNo', header: 'Application No.' },
          { key: 'name', header: 'Candidate' },
          { key: 'category', header: 'Category' },
          { key: 'docs', header: 'Document Status' },
          { key: 'pending', header: 'Awaiting / Missing' },
          { key: 'action', header: 'Action' },
        ]}
        rows={(list.data?.data ?? []).map((app) => ({
          id: app.id,
          cells: {
            appNo: app.applicationNumber,
            name: app.childName || app.firstName,
            category: app.categoryLabel || app.category || '—',
            docs: (
              <SchoolOfficeStatusBadge
                label={
                  app.documentRollup?.filterKey === 'verified'
                    ? 'VERIFIED'
                    : app.documentRollup?.filterKey === 'rejected'
                      ? 'REJECTED – RESUBMISSION REQUIRED'
                      : app.documentRollup?.filterKey === 'incomplete'
                        ? 'NOT UPLOADED'
                        : 'UPLOADED – VERIFICATION PENDING'
                }
                tone={
                  app.documentRollup?.filterKey === 'verified'
                    ? 'success'
                    : app.documentRollup?.filterKey === 'rejected'
                      ? 'danger'
                      : 'warning'
                }
              />
            ),
            pending: app.documentRollup?.pendingCount
              ? `${app.documentRollup.pendingCount} item(s) need attention`
              : '—',
            action: (
              <Button asChild size="sm">
                <Link href={`/admin/school-admissions/${app.id}?tab=documents`}>
                  Open Documents
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
