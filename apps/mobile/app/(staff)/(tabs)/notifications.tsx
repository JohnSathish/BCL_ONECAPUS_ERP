import { useCallback } from 'react';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { NotificationCenterPanel } from '@/components/notifications/notification-center-panel';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';

export default function FacultyNotificationsScreen() {
  const { refreshHome, home } = useFacultyPortal();
  const unread = home?.unreadNotificationCount ?? 0;
  const onChanged = useCallback(() => {
    void refreshHome();
  }, [refreshHome]);

  return (
    <FacultyScreenShell
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : 'Alerts & notices'}
      showMenu={true}
    >
      <NotificationCenterPanel role="staff" theme={facultyTheme} onChanged={onChanged} />
    </FacultyScreenShell>
  );
}
