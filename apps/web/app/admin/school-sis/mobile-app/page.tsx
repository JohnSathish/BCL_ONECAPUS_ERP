'use client';

import { Suspense } from 'react';
import { SchoolMobileAppAdmin } from '@/components/school-sis/school-mobile-app-admin';

export default function SchoolMobileAppPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading app settings…</p>}>
      <SchoolMobileAppAdmin />
    </Suspense>
  );
}
