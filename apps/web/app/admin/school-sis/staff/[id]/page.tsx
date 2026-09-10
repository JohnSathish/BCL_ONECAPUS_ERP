'use client';

import { useParams } from 'next/navigation';
import { SchoolSisStaffProfile } from '@/components/school-sis/school-sis-staff-profile';

export default function SchoolSisStaffDetailPage() {
  const params = useParams<{ id: string }>();
  return <SchoolSisStaffProfile staffId={params.id} />;
}
