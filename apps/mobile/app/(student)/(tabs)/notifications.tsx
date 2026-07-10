import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { NotificationCenterPanel } from '@/components/notifications/notification-center-panel';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';

export default function StudentNotificationsScreen() {
  const { refreshHome, home } = useStudentPortal();
  const unread = home?.unreadNotificationCount ?? 0;

  return (
    <StudentScreenShell
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up'}
    >
      <NotificationCenterPanel
        role="student"
        theme={studentTheme}
        onChanged={() => void refreshHome?.()}
      />
    </StudentScreenShell>
  );
}
