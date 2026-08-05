'use client';

import { School } from 'lucide-react';
import { PrincipalFeaturePlaceholder } from '@/components/principal-desk/principal-feature-placeholder';

export default function PrincipalHostelPage() {
  return (
    <PrincipalFeaturePlaceholder
      title="Hostel"
      subtitle="Residence and warden overview"
      icon={School}
      status="Optional module"
      description="Hostel command center for Principal appears when the hostel module is enabled for your campus. Student Quick Lookup already shows hosteller block/room where recorded."
      related={[
        {
          href: '/principal-desk/student-lookup',
          label: 'Student Quick Lookup',
          description: 'Hostel assignment on the student card',
        },
        {
          href: '/principal-desk/staff',
          label: 'Staff Center',
          description: 'Find wardens and residence staff',
        },
      ]}
    />
  );
}
