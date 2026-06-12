'use client';

import { LibraryAccessDesk } from '@/components/library/library-access-desk';
import { useRequireAuth } from '@/hooks/use-auth';

export default function LibraryDeskPage() {
  useRequireAuth();
  return <LibraryAccessDesk />;
}
