'use client';

import { PortalGuard } from '@/components/school-sis/portal/portal-guard';
import { PortalLayout } from '@/components/school-sis/portal/portal-layout';

export default function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalGuard kind="student">
      <PortalLayout kind="student">{children}</PortalLayout>
    </PortalGuard>
  );
}
