'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchStudentPortalProfile } from '@/services/student-portal';

export default function StudentDocumentsPage() {
  useRequireAuth();
  const profileQ = useQuery({
    queryKey: ['student-portal', 'profile'],
    queryFn: fetchStudentPortalProfile,
  });
  const docs = profileQ.data?.documents ?? [];

  return (
    <DashboardShell role="student" title="My Documents">
      <ErpWorkspace className="space-y-4">
        <GlassCard className="p-5">
          <p className="text-sm text-muted-foreground">
            Upload and track verification status for your documents. Admin approval is required
            before documents are marked verified.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/student/profile">Upload from My Profile</Link>
          </Button>
        </GlassCard>
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold">Uploaded Documents</h2>
          <ul className="mt-4 space-y-2">
            {docs.length ? (
              docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                >
                  <span>
                    {doc.documentType.replace(/_/g, ' ')} · {doc.fileName}
                  </span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {doc.verificationStatus}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">No documents yet.</li>
            )}
          </ul>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
