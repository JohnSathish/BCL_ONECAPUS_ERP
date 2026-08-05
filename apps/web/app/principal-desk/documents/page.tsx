'use client';

import { FileStack } from 'lucide-react';
import { PrincipalFeaturePlaceholder } from '@/components/principal-desk/principal-feature-placeholder';

export default function PrincipalDocumentsPage() {
  return (
    <PrincipalFeaturePlaceholder
      title="Documents & Circulars"
      subtitle="Official circulars and policy documents"
      icon={FileStack}
      description="A Principal documents vault is being prepared. Announcements / Notices remain the primary channel for publishing campus circulars today."
      related={[
        {
          href: '/principal-desk/notices',
          label: 'Announcements',
          description: 'Publish and review campus notices',
        },
        {
          href: '/principal-desk/communication-hub',
          label: 'Mail',
          description: 'Incoming official correspondence',
        },
      ]}
    />
  );
}
