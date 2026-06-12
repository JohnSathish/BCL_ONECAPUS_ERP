'use client';

import Link from 'next/link';
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Users,
  Wallet,
} from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

type ReportSection = {
  title: string;
  description: string;
  icon: typeof Users;
  items: { label: string; href: string; soon?: boolean }[];
};

const SECTIONS: ReportSection[] = [
  {
    title: 'Student Reports',
    description: 'Registers, strength, and programme-wise student analytics.',
    icon: Users,
    items: [
      { label: 'Student Reports Hub', href: '/admin/reports/students' },
      { label: 'Student Export Hub', href: '/admin/students/export' },
      { label: 'Admission Register', href: '/admin/reports/admissions' },
      { label: 'Alumni Report', href: '/admin/students/archive' },
    ],
  },
  {
    title: 'Attendance Reports',
    description: 'Student and staff attendance summaries and defaulter lists.',
    icon: ClipboardList,
    items: [
      { label: 'Student Attendance', href: '/admin/academics/attendance' },
      { label: 'Staff Daily Report', href: '/admin/staff/attendance/reports/daily' },
      { label: 'Staff Monthly Report', href: '/admin/staff/attendance/reports/monthly' },
      { label: 'Defaulters & Eligibility', href: '/admin/reports/attendance/defaulters' },
    ],
  },
  {
    title: 'Examination Reports',
    description: 'Internal marks, results, and university examination outputs.',
    icon: GraduationCap,
    items: [
      { label: 'Examination Module', href: '/admin/academics/examinations' },
      { label: 'Hall Tickets', href: '/admin/academics/examinations', soon: true },
      { label: 'Results & Rankers', href: '/admin/academics/examinations', soon: true },
    ],
  },
  {
    title: 'Fee Reports',
    description: 'Collections, outstanding dues, and scholarship adjustments.',
    icon: Wallet,
    items: [
      { label: 'Fee Reports', href: '/admin/fees/reports' },
      { label: 'Collection Console', href: '/admin/fees/collections' },
      { label: 'Outstanding Summary', href: '/admin/reports/fees/outstanding' },
      { label: 'Defaulter Intelligence', href: '/admin/fees/defaulters' },
    ],
  },
  {
    title: 'Certificate Reports',
    description: 'Issuance trends, verification activity, and audit trails.',
    icon: Award,
    items: [
      { label: 'Certificate Analytics', href: '/admin/certificates/analytics' },
      { label: 'Certificate Audit Logs', href: '/admin/certificates/audit' },
      { label: 'Verification Portal', href: '/admin/certificates/verification' },
    ],
  },
  {
    title: 'Academic Reports',
    description: 'Timetable, teaching load, and curriculum reporting.',
    icon: BookOpen,
    items: [
      { label: 'Timetable Reports', href: '/admin/academics/timetable/reports' },
      { label: 'Staff Workload', href: '/admin/staff/workload' },
      { label: 'Compliance Exports', href: '/admin/reports/compliance' },
    ],
  },
];

export default function ReportsHubPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Reports">
      <div className="space-y-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Central reporting hub for student, attendance, examination, fee, certificate, and academic
          analytics. Each section links to the live report workspace in its source module.
        </p>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <section.icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-foreground">{section.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li key={item.label}>
                    {item.soon ? (
                      <span className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-muted-foreground">
                        {item.label}
                        <span className="text-[10px] uppercase tracking-wide">Soon</span>
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className="block rounded-lg px-2 py-1.5 text-sm text-foreground transition hover:bg-muted"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <BarChart3 className="mb-2 h-4 w-4" />
          Institution-wide analytics and accreditation packs are grouped here instead of being
          scattered under individual modules.
        </div>
      </div>
    </DashboardShell>
  );
}
