'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectClasses() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/school-sis/academic/classes');
  }, [router]);
  return <p className="text-sm text-slate-500">Opening classes…</p>;
}
