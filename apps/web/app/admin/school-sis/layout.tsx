'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { isSecondarySchoolSisSession } from '@/lib/school-erp/product';

export default function SchoolSisLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, isReady } = useAuth();
  const allowed = isSecondarySchoolSisSession({
    tenantSlug: session?.user.tenantSlug,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
  });

  useEffect(() => {
    if (isReady && session && !allowed) {
      router.replace('/admin');
    }
  }, [allowed, isReady, router, session]);

  if (!isReady) return <p className="text-sm text-slate-500">Loading…</p>;
  if (session && !allowed) return null;
  return <>{children}</>;
}
