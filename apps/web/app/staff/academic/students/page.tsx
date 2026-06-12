'use client';
import { StaffModulePlaceholder } from '@/components/staff-portal/layout/staff-module-placeholder';
export default function Page() {
  return (
    <StaffModulePlaceholder
      title="Student Lists"
      heading="Student Lists"
      description="Section-wise student rosters for your assigned papers."
      actionHref="/staff/academic/subjects"
      actionLabel="My subjects"
    />
  );
}
