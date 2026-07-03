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
    <StudentReportSectionPage
      key={tab.id}
      title="NEP Bucket Reports"
      description={`${tab.label} enrollment, strength, and popularity analysis.`}
      reportType={tab.id}
      beforeFilters={
        <div className="flex flex-wrap gap-2 print:hidden">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                tab.id === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
