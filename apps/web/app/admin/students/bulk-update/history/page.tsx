import { Suspense } from 'react';

import { BulkUpdateHistoryPage } from '@/components/students-module/bulk-update/bulk-update-history-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BulkUpdateHistoryPage />
    </Suspense>
  );
}
