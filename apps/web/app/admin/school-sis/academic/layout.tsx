'use client';

import { AcademicSubnav } from '@/components/school-sis/academic/academic-ui';

export default function AcademicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <AcademicSubnav />
      {children}
    </div>
  );
}
