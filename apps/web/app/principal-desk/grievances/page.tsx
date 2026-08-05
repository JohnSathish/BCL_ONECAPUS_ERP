'use client';

import { MessageSquareWarning } from 'lucide-react';
import { PrincipalFeaturePlaceholder } from '@/components/principal-desk/principal-feature-placeholder';

export default function PrincipalGrievancesPage() {
  return (
    <PrincipalFeaturePlaceholder
      title="Complaints & Grievances"
      subtitle="Student and staff grievance oversight"
      icon={MessageSquareWarning}
      description="Principal grievance inbox and SLA tracking are planned next. Committee Activity remains the governance channel for formal escalations."
      related={[
        {
          href: '/principal-desk/committees',
          label: 'Committees',
          description: 'Pending ATR and committee workload',
        },
        {
          href: '/principal-desk/leave',
          label: 'Leave Approvals',
          description: 'Staff / student leave actions',
        },
      ]}
    />
  );
}
