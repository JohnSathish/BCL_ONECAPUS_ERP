'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { resolveSchoolSisHomePath } from '@/lib/school-sis/portal-access';

export default function SchoolSisPortalIndex() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    router.replace(
      resolveSchoolSisHomePath(session.user.roles ?? [], session.user.permissions ?? []),
    );
  }, [isReady, session, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-slate-600">
      Opening your portal…
    </div>
  );
}
