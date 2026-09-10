'use client';

import { useParams } from 'next/navigation';
import { StudentMasterForm } from '@/components/school-sis/student-master-form';

export default function EditSchoolStudentPage() {
  const params = useParams<{ id: string }>();
  return <StudentMasterForm studentId={params.id} />;
}
