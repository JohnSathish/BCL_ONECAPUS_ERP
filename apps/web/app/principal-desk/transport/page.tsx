'use client';

import { Bus } from 'lucide-react';
import { PrincipalFeaturePlaceholder } from '@/components/principal-desk/principal-feature-placeholder';

export default function PrincipalTransportPage() {
  return (
    <PrincipalFeaturePlaceholder
      title="Transport"
      subtitle="Routes, occupancy, and incidents"
      icon={Bus}
      status="Optional module"
      description="Transport overview for Principal will appear for campuses that run the transport module. Until then, operational reports remain under admin logistics."
      related={[
        {
          href: '/principal-desk/reports',
          label: 'Reports & Analytics',
          description: 'Institutional report launchpad',
        },
        {
          href: '/principal-desk',
          label: 'Dashboard',
          description: 'Campus pulse and critical alerts',
        },
      ]}
    />
  );
}
