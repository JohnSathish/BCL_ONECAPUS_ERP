'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PrincipalScannerHub } from '@/components/principal-desk/principal-scanner-hub';

function StudentLookupInner() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? undefined;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">Student Quick Lookup</h1>
      <PrincipalScannerHub defaultMode="student" initialQuery={q} />
    </div>
  );
}

export default function StudentLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="mb-4 text-xl font-bold">Student Quick Lookup</h1>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <StudentLookupInner />
    </Suspense>
  );
}
