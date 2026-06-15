'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';

export default function ComplianceReportsPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Compliance Reports">
      <Card>
        <CardHeader>
          <CardTitle>Accreditation & compliance exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            NAAC accreditation is managed through the NAAC & IQAC module (NIMS). Use the Evidence
            Repository for criterion-wise tagging and export packs. Governance module continues to
            host committee/IQAC meeting operations.
          </p>
          <Button asChild>
            <Link href="/admin/naac">
              Open NAAC & IQAC (NIMS)
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
