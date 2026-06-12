'use client';

import { use } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrAccommodationPage } from '@/components/hr-module/hr-accommodation-page';
import { HrLoansPage } from '@/components/hr-module/hr-loans-page';
import { HrAppraisalPage } from '@/components/hr-module/hr-appraisal-page';
import { HrDesignationsPage } from '@/components/hr-module/hr-designations-page';
import { HrLeavePage } from '@/components/hr-module/hr-leave-page';
import { HrPensionPage } from '@/components/hr-module/hr-pension-page';
import { HrRecruitmentPage } from '@/components/hr-module/hr-recruitment-page';
import { HrWorkspace } from '@/components/hr-module/hr-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

const workspacePages = {
  'salary-components': 'Salary Components',
  'pay-structures': 'Pay Structures',
  assignments: 'Pay Assignments',
  revisions: 'Salary Revisions',
  increments: 'Increment Management',
  'pf-cpf': 'PF / CPF / NPS',
  payslips: 'Payslips',
  reports: 'HR Reports',
  settings: 'HR Settings',
} as const;

const standalonePages = {
  designations: { title: 'Designations', Component: HrDesignationsPage },
  leave: { title: 'Leave Management', Component: HrLeavePage },
  recruitment: { title: 'Recruitment', Component: HrRecruitmentPage },
  appraisal: { title: 'Performance Appraisal', Component: HrAppraisalPage },
  pension: { title: 'Pension', Component: HrPensionPage },
  accommodation: { title: 'Staff Accommodation', Component: HrAccommodationPage },
  loans: { title: 'Loans & Advances', Component: HrLoansPage },
} as const;

type WorkspaceSlug = keyof typeof workspacePages;
type StandaloneSlug = keyof typeof standalonePages;

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  const session = useRequireAuth();
  const { slug: slugParam } = use(params);
  if (!session) return null;

  const slug = slugParam as WorkspaceSlug | StandaloneSlug;

  if (slug in standalonePages) {
    const { title, Component } = standalonePages[slug as StandaloneSlug];
    return (
      <DashboardShell role="admin" title={title}>
        <Component />
      </DashboardShell>
    );
  }

  const title = workspacePages[slug as WorkspaceSlug] ?? 'Human Resources';
  return (
    <DashboardShell role="admin" title={title}>
      <HrWorkspace page={slug as Parameters<typeof HrWorkspace>[0]['page']} />
    </DashboardShell>
  );
}
