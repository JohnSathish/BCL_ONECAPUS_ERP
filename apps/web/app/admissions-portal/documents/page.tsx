'use client';

import Link from 'next/link';
import { AdmissionsApplicantLayout } from '@/components/admissions-portal/admissions-applicant-layout';
import { AdmissionsDocumentsPanel } from '@/components/admissions-portal/admissions-documents-panel';
import { Button } from '@/components/ui/button';

export default function ApplicantDocumentsPage() {
  return (
    <AdmissionsApplicantLayout>
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/admissions-portal/dashboard">← Dashboard</Link>
        </Button>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#1a2b4b]">Documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload and track required marksheets and certificates. JPEG, PNG, or PDF — max 5 MB each.
        </p>
      </div>

      <AdmissionsDocumentsPanel />
    </AdmissionsApplicantLayout>
  );
}
