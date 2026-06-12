'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FacultyTimetableRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/staff/academic/timetable');
  }, [router]);
  return null;
}
