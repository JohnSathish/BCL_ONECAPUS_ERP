'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { SaaSCard } from '@/components/dashboard/command-center-ui';

const REPORT_LINKS = [
  { label: 'Attendance Defaulters', href: '/admin/reports/attendance/defaulters' },
  { label: 'Fee Collection Reports', href: '/admin/fees/reports' },
  { label: 'Student Directory', href: '/admin/students' },
  { label: 'Staff Directory', href: '/admin/hr' },
  { label: 'Examination Reports', href: '/admin/academics/examinations' },
  { label: 'NAAC Reports', href: '/admin/naac-iqac' },
  { label: 'Governance Reports', href: '/admin/governance/reports' },
  { label: 'Library Analytics', href: '/admin/library' },
];

export default function ReportsPage() {
  return (
    <PrincipalDeskShell title="Reports" subtitle="Quick access to institutional reports">
      <div className="grid gap-3 sm:grid-cols-2">
        {REPORT_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <SaaSCard className="flex items-center justify-between transition hover:border-indigo-300 hover:shadow-md">
              <span className="font-semibold text-slate-900">{link.label}</span>
              <ArrowRight className="h-4 w-4 text-indigo-600" />
            </SaaSCard>
          </Link>
        ))}
      </div>
    </PrincipalDeskShell>
  );
}
