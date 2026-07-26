'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentLiveChatEnterprise } from '@/components/support-centre/student-live-chat-enterprise';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentSupportChatPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="Live Chat">
      <StudentLiveChatEnterprise />
    </DashboardShell>
  );
}
