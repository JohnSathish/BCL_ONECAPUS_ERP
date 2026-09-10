'use client';

import { useParams } from 'next/navigation';
import { SchoolSisStudentProfile } from '@/components/school-sis/school-sis-student-profile';

export default function SchoolSisStudentDetailPage() {
  const params = useParams<{ id: string }>();
  return <SchoolSisStudentProfile studentId={params.id} />;
}
