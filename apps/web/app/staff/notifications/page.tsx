'use client';

import { StaffModulePlaceholder } from '@/components/staff-portal/layout/staff-module-placeholder';

export default function StaffNotificationsPage() {
  return (
    <StaffModulePlaceholder
      title="Notifications"
      heading="Notifications Center"
      description="Real-time alerts for exam duty, timetable changes, circulars, attendance reminders, and payroll releases. Mark read and filter by category."
      actionHref="/staff/dashboard"
      actionLabel="Back to dashboard"
    />
  );
}
