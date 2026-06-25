'use client';

import { OfficialDocumentsListPage } from '@/components/official-documents-module/official-documents-list';

export default function Page() {
  return (
    <OfficialDocumentsListPage
      documentType="NOTICE"
      title="Notices"
      description="Institutional notices issued from the Principal or Vice Principal office."
    />
  );
}
