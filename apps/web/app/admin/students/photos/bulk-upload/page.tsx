import { Suspense } from 'react';

import { StudentPhotoBulkPage } from '@/components/students-module/photo-bulk/student-photo-bulk-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StudentPhotoBulkPage />
    </Suspense>
  );
}
