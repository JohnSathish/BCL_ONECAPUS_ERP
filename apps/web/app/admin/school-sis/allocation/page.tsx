'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectAllocation() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/school-sis/academic/staff');
  }, [router]);
  return <p className="text-sm text-slate-500">Opening class-wise staff…</p>;
}
