'use client';

import { use } from 'react';
import { OfficialDocumentDetailPage } from '@/components/official-documents-module/official-document-detail';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <OfficialDocumentDetailPage id={id} />;
}
