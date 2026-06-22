import { Suspense } from 'react';
import CareersApplicationStatusPage from './status-client';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading…</div>}>
      <CareersApplicationStatusPage />
    </Suspense>
  );
}
