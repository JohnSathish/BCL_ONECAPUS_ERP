'use client';

import { PrincipalDeskNav } from '@/components/principal-desk/principal-desk-nav';
import { PrincipalScannerHub } from '@/components/principal-desk/principal-scanner-hub';

export default function StudentLookupPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <PrincipalDeskNav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">Student Quick Lookup</h1>
        <PrincipalScannerHub defaultMode="student" />
      </main>
    </div>
  );
}
