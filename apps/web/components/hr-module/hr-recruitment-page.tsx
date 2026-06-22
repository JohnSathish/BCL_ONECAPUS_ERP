'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchRecruitmentStats, fetchRecruitmentVacancies } from '@/services/hr';
import { HrRecruitmentHeroBanner } from '@/components/hr-module/recruitment/hr-recruitment-hero-banner';
import { HrRecruitmentDashboardKpis } from '@/components/hr-module/recruitment/hr-recruitment-dashboard-kpis';
import { HrRecruitmentQuickActions } from '@/components/hr-module/recruitment/hr-recruitment-quick-actions';
import { HrRecruitmentVacancyWizard } from '@/components/hr-module/recruitment/hr-recruitment-vacancy-wizard';
import { HrRecruitmentVacancyCards } from '@/components/hr-module/recruitment/hr-recruitment-vacancy-cards';
import { HrRecruitmentVacancyEditor } from '@/components/hr-module/recruitment/hr-recruitment-vacancy-editor';
import { HrRecruitmentAtsBoard } from '@/components/hr-module/recruitment/hr-recruitment-ats-board';
import { HrRecruitmentInterviewsPanel } from '@/components/hr-module/recruitment/hr-recruitment-interviews-panel';
import { HrRecruitmentAnalytics } from '@/components/hr-module/recruitment/hr-recruitment-analytics';
import { HrRecruitmentPortalCard } from '@/components/hr-module/recruitment/hr-recruitment-portal-card';
import { HrRecruitmentActivityFeed } from '@/components/hr-module/recruitment/hr-recruitment-activity-feed';
import { cn } from '@/utils/cn';

type Tab = 'overview' | 'applications' | 'vacancies' | 'interviews' | 'analytics';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'applications', label: 'Pipeline (ATS)' },
  { id: 'vacancies', label: 'Vacancies' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'analytics', label: 'Analytics' },
];

export function HrRecruitmentPage() {
  const enabled = useAuthQueryEnabled();
  const [tab, setTab] = useState<Tab>('overview');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editVacancyId, setEditVacancyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const statsQ = useQuery({
    queryKey: ['hr', 'recruitment', 'stats'],
    queryFn: fetchRecruitmentStats,
    enabled,
  });
  const vacanciesQ = useQuery({
    queryKey: ['hr', 'recruitment', 'vacancies'],
    queryFn: () => fetchRecruitmentVacancies(),
    enabled,
  });

  const stats = statsQ.data;
  const vacancies = vacanciesQ.data ?? [];

  return (
    <div className="space-y-6 pb-8">
      <HrRecruitmentHeroBanner />

      <HrRecruitmentDashboardKpis stats={stats} isLoading={statsQ.isLoading} />

      <HrRecruitmentQuickActions
        onCreateVacancy={() => setWizardOpen(true)}
        onScheduleInterview={() => setTab('interviews')}
      />

      {toast ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {toast}
        </p>
      ) : null}

      <div className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-xl border bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition',
              tab === t.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {tab === 'overview' && (
            <div className="space-y-6">
              <section>
                <h3 className="mb-4 text-lg font-semibold">Open Positions</h3>
                <HrRecruitmentVacancyCards
                  vacancies={vacancies.filter((v) => v.status === 'PUBLISHED').slice(0, 4)}
                  isLoading={vacanciesQ.isLoading}
                  onEdit={setEditVacancyId}
                  onCreate={() => setWizardOpen(true)}
                />
              </section>
              <section>
                <h3 className="mb-4 text-lg font-semibold">Candidate Pipeline</h3>
                <HrRecruitmentAtsBoard />
              </section>
            </div>
          )}

          {tab === 'applications' && <HrRecruitmentAtsBoard />}

          {tab === 'vacancies' && (
            <HrRecruitmentVacancyCards
              vacancies={vacancies}
              isLoading={vacanciesQ.isLoading}
              onEdit={setEditVacancyId}
              onCreate={() => setWizardOpen(true)}
            />
          )}

          {tab === 'interviews' && <HrRecruitmentInterviewsPanel />}

          {tab === 'analytics' && <HrRecruitmentAnalytics />}
        </div>

        <aside className="hidden space-y-0 xl:block">
          <HrRecruitmentPortalCard stats={stats} vacancies={vacancies} />
          <HrRecruitmentActivityFeed />
        </aside>
      </div>

      <HrRecruitmentVacancyWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={() => setToast('Vacancy created successfully.')}
      />

      <HrRecruitmentVacancyEditor
        vacancyId={editVacancyId}
        open={Boolean(editVacancyId)}
        onOpenChange={(open) => {
          if (!open) setEditVacancyId(null);
        }}
      />
    </div>
  );
}
