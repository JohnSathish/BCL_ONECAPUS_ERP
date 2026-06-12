'use client';

import { Suspense } from 'react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AdminSubjectRegistrationPage } from '@/components/students-module/admin-subject-registration-page';

export default function StudentSubjectRegistrationPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell role="admin" title="Subject Registration">
          <div />
        </DashboardShell>
      }
    >
      <AdminSubjectRegistrationPage />
    </Suspense>
  );
}
