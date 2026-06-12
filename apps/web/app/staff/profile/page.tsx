'use client';

import { Suspense } from 'react';

import { StaffPortalProfilePage } from '@/components/staff-portal/pages/staff-profile-page';

export default function StaffProfileRoute() {
  return (
    <Suspense fallback={null}>
      <StaffPortalProfilePage />
    </Suspense>
  );
}
