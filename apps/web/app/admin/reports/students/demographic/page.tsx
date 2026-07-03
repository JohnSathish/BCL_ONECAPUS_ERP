'use client';

import { useState } from 'react';

import { StudentReportSectionPage } from '@/components/student-reports/student-report-section-page';
import type { StudentReportType } from '@/services/student-reports';

const TABS: { id: StudentReportType; label: string; mode?: 'distribution' | 'age' }[] = [
  { id: 'gender', label: 'Gender' },
  { id: 'category', label: 'Category' },
  { id: 'religion', label: 'Religion' },
  { id: 'denomination', label: 'Denomination' },
  { id: 'age', label: 'Age Analysis', mode: 'age' },
  { id: 'blood-group', label: 'Blood Group' },
];

export default function DemographicReportsPage() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <StudentReportSectionPage
      key={tab.id}
      title="Demographic Reports"
      description={`${tab.label} distribution and cross-tab analysis for institutional reporting.`}
      reportType={tab.id}
      mode={tab.mode ?? 'distribution'}
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
