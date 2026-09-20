'use client';

import { usePathname } from 'next/navigation';
import { AcademicSubnav } from '@/components/school-sis/academic/academic-ui';

export default function AcademicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.includes('/academic/calendar')) {
    return <>{children}</>;
  }
  return (
    <div className="space-y-5">
      <AcademicSubnav />
      {children}
    </div>
  );
}
