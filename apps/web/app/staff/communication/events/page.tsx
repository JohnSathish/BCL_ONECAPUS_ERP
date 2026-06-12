'use client';
import { StaffModulePlaceholder } from '@/components/staff-portal/layout/staff-module-placeholder';
export default function Page() {
  return (
    <StaffModulePlaceholder
      title="Events"
      heading="Events"
      description="Institutional events, seminars, workshops, and college calendar entries."
      actionHref="/staff/calendar"
      actionLabel="Open calendar"
    />
  );
}
