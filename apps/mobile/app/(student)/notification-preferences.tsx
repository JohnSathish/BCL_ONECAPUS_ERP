import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { NotificationPreferencesPanel } from '@/components/notifications/notification-preferences-panel';
import { studentTheme } from '@/components/student-portal/theme';

export default function StudentNotificationPreferencesScreen() {
  return (
    <StudentScreenShell title="Notification Preferences" subtitle="Push categories">
      <NotificationPreferencesPanel role="student" theme={studentTheme} />
    </StudentScreenShell>
  );
}
