import { Suspense } from 'react';

import { BulkUpdatePage } from '@/components/students-module/bulk-update/bulk-update-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BulkUpdatePage />
    </Suspense>
  );
}
