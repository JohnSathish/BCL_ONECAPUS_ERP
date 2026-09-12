'use client';

import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Home,
  Sparkles,
  Users,
  UserCheck,
} from 'lucide-react';
import { AcademicPageHeader } from './academic-ui';

const MODULES = [
  {
    href: '/admin/school-sis/academic/years',
    title: 'Academic Year',
    hint: 'Dates, current year, archive history',
    icon: CalendarDays,
  },
  {
    href: '/admin/school-sis/academic/classes',
    title: 'Classes',
    hint: 'Classes, sections, capacity, class teacher',
    icon: BookOpen,
  },
  {
    href: '/admin/school-sis/academic/subjects',
    title: 'Subjects',
    hint: 'Codes, types, marks, theory/practical',
    icon: BookOpen,
  },
  {
    href: '/admin/school-sis/academic/class-subjects',
    title: 'Class-wise Subjects',
    hint: 'Bulk map subjects and teachers',
    icon: BookOpen,
  },
  {
    href: '/admin/school-sis/academic/staff',
    title: 'Class-wise Staff',
    hint: 'Workload and class/subject teachers',
    icon: Users,
  },
  {
    href: '/admin/school-sis/timetable',
    title: 'Staff Timetable',
    hint: 'Periods, rooms, conflict checks',
    icon: CalendarDays,
  },
  {
    href: '/admin/school-sis/academic/optionals',
    title: 'Optional Mapping',
    hint: 'Electives per student',
    icon: Sparkles,
  },
  {
    href: '/admin/school-sis/academic/houses',
    title: 'Houses',
    hint: 'House colour, captain, bulk assign',
    icon: Home,
  },
  {
    href: '/admin/school-sis/academic/clubs',
    title: 'Clubs',
    hint: 'Coordinators, members, activities',
    icon: Sparkles,
  },
  {
    href: '/admin/school-sis/academic/promotion',
    title: 'Promotion',
    hint: 'Promote, hold back, withdraw — keep history',
    icon: GraduationCap,
  },
  {
    href: '/admin/school-sis/academic/id-cards',
    title: 'ID Card Template',
    hint: 'Live preview with logo, photo and QR',
    icon: CreditCard,
  },
  {
    href: '/admin/school-sis/students',
    title: 'Students',
    hint: 'Master records used by this academic year',
    icon: UserCheck,
  },
];

export function SchoolSisAcademicHub() {
  return (
    <div className="space-y-6">
      <AcademicPageHeader
        title="Academic Configuration"
        description="Core school setup for the current session. Years, classes, subjects, staff, houses and promotion all share the same student and staff records."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {MODULES.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-[var(--school-erp-border)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[var(--school-erp-primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-3 font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{item.hint}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
