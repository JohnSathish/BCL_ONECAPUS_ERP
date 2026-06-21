'use client';

import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { PrincipalIaDashboard } from '@/components/examinations/ia/principal-ia-dashboard';
import { useRequireAuth } from '@/hooks/use-auth';

export default function PrincipalExaminationsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <PrincipalDeskShell title="Examinations" subtitle="Internal Assessment overview">
      <PrincipalIaDashboard />
    </PrincipalDeskShell>
  );
}
