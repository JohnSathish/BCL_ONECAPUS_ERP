'use client';

import { PortalGuard } from '@/components/school-sis/portal/portal-guard';
import { PortalLayout } from '@/components/school-sis/portal/portal-layout';

export default function PrincipalPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalGuard kind="principal">
      <PortalLayout kind="principal">{children}</PortalLayout>
    </PortalGuard>
  );
}
