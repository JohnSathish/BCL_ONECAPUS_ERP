'use client';

import type { PrincipalDeskSnapshot } from '@/types/principal-desk';
import {
  BookMarked,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Library,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
} from 'lucide-react';
import { KpiCard } from '@/components/dashboard/command-center-ui';

export function PrincipalSnapshotCards({ snapshot }: { snapshot: PrincipalDeskSnapshot }) {
  const cards = [
    {
      label: 'Total Students',
      value: snapshot.totalStudents,
      icon: GraduationCap,
      tone: 'blue' as const,
    },
    {
      label: 'Students Present',
      value: snapshot.studentsPresentToday,
      icon: UserCheck,
      tone: 'green' as const,
    },
    {
      label: 'Students Absent',
      value: snapshot.studentsAbsentToday,
      icon: UserMinus,
      tone: 'red' as const,
    },
    {
      label: 'Staff Present',
      value: snapshot.staffPresentToday,
      icon: Users,
      tone: 'green' as const,
    },
    {
      label: 'Staff Absent',
      value: snapshot.staffAbsentToday,
      icon: UserMinus,
      tone: 'orange' as const,
    },
    {
      label: 'Classes Conducted',
      value: snapshot.classesConductedToday,
      icon: ClipboardList,
      tone: 'blue' as const,
    },
    {
      label: 'Fee Defaulters',
      value: snapshot.feeDefaulters,
      icon: Wallet,
      tone: 'red' as const,
    },
    {
      label: 'Library Overdue',
      value: snapshot.libraryOverdueStudents,
      icon: Library,
      tone: 'orange' as const,
    },
    {
      label: 'Leave Pending',
      value: snapshot.leaveRequestsPending,
      icon: CalendarDays,
      tone: 'orange' as const,
    },
    {
      label: 'Upcoming Events',
      value: snapshot.upcomingEvents,
      icon: BookMarked,
      tone: 'purple' as const,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          label={card.label}
          value={String(card.value)}
          icon={card.icon}
          tone={card.tone}
        />
      ))}
    </div>
  );
}
