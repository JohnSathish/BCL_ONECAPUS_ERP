'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FacultyAttendanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/staff/attendance');
  }, [router]);
  return null;
}
