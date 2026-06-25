'use client';

import { OfficialDocumentsListPage } from '@/components/official-documents-module/official-documents-list';

export default function Page() {
  return (
    <OfficialDocumentsListPage
      status="ARCHIVED"
      title="Archive"
      description="Permanently stored official documents. Nothing is deleted."
    />
  );
}
