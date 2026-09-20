'use client';

import { use } from 'react';
import { StaffSection } from '@/components/school-sis/portal/staff-pages';

export default function StaffPortalSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  return <StaffSection section={section} />;
}
