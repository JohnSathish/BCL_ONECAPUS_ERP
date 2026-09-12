'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const tab = params.get('tab');
    router.replace(`/admin/school-sis/academic/subjects${tab ? `?tab=${tab}` : ''}`);
  }, [params, router]);
  return <p className="text-sm text-slate-500">Opening subjects…</p>;
}

export default function RedirectSubjects() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Opening subjects…</p>}>
      <Inner />
    </Suspense>
  );
}
