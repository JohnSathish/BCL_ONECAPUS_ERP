import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { NotificationPreferencesPanel } from '@/components/notifications/notification-preferences-panel';
import { facultyTheme } from '@/components/faculty-portal/theme';

export default function StaffNotificationPreferencesScreen() {
  return (
    <FacultyScreenShell title="Notification preferences" subtitle="Push categories">
      <NotificationPreferencesPanel role="staff" theme={facultyTheme} />
    </FacultyScreenShell>
  );
}
