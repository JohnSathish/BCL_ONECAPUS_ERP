'use client';

import { use } from 'react';
import { HrEmployeeProfile } from '@/components/school-sis/hr/hr-employee';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <HrEmployeeProfile id={id} />;
}
