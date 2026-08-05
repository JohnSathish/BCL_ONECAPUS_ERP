'use client';

import { Bell } from 'lucide-react';
import { PrincipalFeaturePlaceholder } from '@/components/principal-desk/principal-feature-placeholder';

export default function PrincipalNotificationsPage() {
  return (
    <PrincipalFeaturePlaceholder
      title="Notifications"
      subtitle="Campus alerts and approval reminders"
      icon={Bell}
      description="A unified Principal notification center is being prepared. Critical leave, fee, and mail alerts already appear on your Dashboard and in the sidebar badges."
      related={[
        {
          href: '/principal-desk',
          label: 'Dashboard alerts',
          description: 'Live critical actions and campus pulse',
        },
        {
          href: '/principal-desk/leave',
          label: 'Leave Approvals',
          description: 'Pending staff and student leave',
        },
        {
          href: '/principal-desk/communication-hub',
          label: 'Mail',
          description: 'Unread principal mailbox',
        },
      ]}
    />
  );
}
