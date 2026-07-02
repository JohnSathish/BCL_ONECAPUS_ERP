'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Deprecated shift portal — all shift admins use /admin with workspace context. */
export default function ShiftPortalRedirectLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return children;
}
