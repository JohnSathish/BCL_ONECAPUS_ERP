'use client';

import { Library } from 'lucide-react';
import { PrincipalFeaturePlaceholder } from '@/components/principal-desk/principal-feature-placeholder';

export default function PrincipalLibraryPage() {
  return (
    <PrincipalFeaturePlaceholder
      title="Library Overview"
      subtitle="Circulation, overdue, and fine snapshot"
      icon={Library}
      description="A Principal library dashboard is on the roadmap. Institutional Health and Student Quick Lookup already surface overdue and fine signals."
      related={[
        {
          href: '/principal-desk/health',
          label: 'Institutional Health',
          description: 'Library factor in campus health score',
        },
        {
          href: '/principal-desk/student-lookup',
          label: 'Student Quick Lookup',
          description: 'Per-student holds, due books, fines',
        },
        {
          href: '/admin/library',
          label: 'Library module',
          description: 'Full library operations (admin)',
        },
      ]}
    />
  );
}
