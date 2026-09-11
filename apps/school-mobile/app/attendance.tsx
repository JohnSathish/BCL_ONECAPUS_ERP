import { EmptyState, Screen } from '@/ui/kit';

export default function AttendanceScreen() {
  return (
    <Screen title="Attendance">
      <EmptyState
        title="Attendance is coming to the app"
        body="Class attendance is managed in the school ERP. When it is enabled, today’s status will appear here."
      />
    </Screen>
  );
}
