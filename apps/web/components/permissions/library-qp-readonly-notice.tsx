'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  isLibraryQpReadonly,
  libraryQpReadonlyPageIsWritable,
} from '@/lib/permissions/library-qp-readonly';

export function LibraryQpReadonlyNotice() {
  const pathname = usePathname() ?? '';
  const { session } = useAuth();
  if (!isLibraryQpReadonly(session?.user.roles, session?.user.email)) return null;
  if (libraryQpReadonlyPageIsWritable(pathname)) return null;

  return (
    <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
      You can view this module. Changes are available in the library and the question paper
      repository.
    </p>
  );
}
