'use client';
import { StaffModulePlaceholder } from '@/components/staff-portal/layout/staff-module-placeholder';
export default function Page() {
  return (
    <StaffModulePlaceholder
      title="Department Tasks"
      heading="Department Tasks"
      description="Operational tasks assigned to your department or committee."
      actionHref="/staff/department"
      actionLabel="Department workspace"
    />
  );
}
