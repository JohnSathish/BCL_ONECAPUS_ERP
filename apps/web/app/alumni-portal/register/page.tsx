import { Suspense } from 'react';
import AlumniRegisterPageClient from './register-client';

export default function AlumniRegisterPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-[#1a2b47]/70">Loading registration…</p>}>
      <AlumniRegisterPageClient />
    </Suspense>
  );
}
