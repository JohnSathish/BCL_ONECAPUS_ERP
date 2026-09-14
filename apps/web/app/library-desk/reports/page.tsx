'use client';

import { Suspense } from 'react';
import { LibraryIoReportsWorkspace } from '@/components/library/library-io-reports-workspace';

export default function LibraryDeskReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0f1e] text-sm text-slate-400">
          Opening library reports…
        </div>
      }
    >
      <LibraryIoReportsWorkspace />
    </Suspense>
  );
}
