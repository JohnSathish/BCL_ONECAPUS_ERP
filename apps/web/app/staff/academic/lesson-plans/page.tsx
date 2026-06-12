'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export default function Page() {
  const session = useRequireStaffPortal();
  const router = useRouter();
  useEffect(() => {
    if (session) router.replace('/staff/academic/lms');
  }, [session, router]);
  return null;
}
