'use client';

import { CalendarRange } from 'lucide-react';
import { PrincipalFeaturePlaceholder } from '@/components/principal-desk/principal-feature-placeholder';

export default function PrincipalTimetablePage() {
  return (
    <PrincipalFeaturePlaceholder
      title="Timetable"
      subtitle="Institution-wide schedule overview"
      icon={CalendarRange}
      description="Principal-level timetable command view is coming soon. Use Academic Performance and Attendance Overview for class engagement and coverage today."
      related={[
        {
          href: '/principal-desk/academic',
          label: 'Academic Performance',
          description: 'Classes completed, faculty engagement',
        },
        {
          href: '/principal-desk/attendance',
          label: 'Attendance Overview',
          description: 'Student and staff presence',
        },
        {
          href: '/principal-desk/events',
          label: 'Events & Calendar',
          description: 'Meetings and campus calendar',
        },
      ]}
    />
  );
}
