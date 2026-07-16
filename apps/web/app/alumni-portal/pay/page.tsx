import { Suspense } from 'react';
import AlumniPayPageClient from './pay-client';

export default function AlumniPayPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading payment…</div>}>
      <AlumniPayPageClient />
    </Suspense>
  );
}
