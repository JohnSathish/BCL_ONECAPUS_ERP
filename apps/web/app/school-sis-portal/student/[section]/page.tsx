'use client';

import { use } from 'react';
import { StudentSection } from '@/components/school-sis/portal/student-pages';

export default function StudentPortalSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  return <StudentSection section={section} />;
}
