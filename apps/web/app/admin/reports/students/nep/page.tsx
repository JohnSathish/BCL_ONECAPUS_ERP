'use client';

import { useState } from 'react';

import { StudentReportSectionPage } from '@/components/student-reports/student-report-section-page';
import type { StudentReportType } from '@/services/student-reports';

const TABS: { id: StudentReportType; label: string }[] = [
  { id: 'mdc', label: 'MDC' },
  { id: 'aec', label: 'AEC' },
  { id: 'sec', label: 'SEC' },
  { id: 'vac', label: 'VAC' },
];

export default function NepReportsPage() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 px-1 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab.id === t.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <StudentReportSectionPage
        key={tab.id}
        title="NEP Bucket Reports"
        description={`${tab.label} enrollment, strength, and popularity analysis.`}
        reportType={tab.id}
      />
    </div>
  );
}
