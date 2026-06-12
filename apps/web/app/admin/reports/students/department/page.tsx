'use client';

import { useState } from 'react';

import { StudentReportSectionPage } from '@/components/student-reports/student-report-section-page';
import type { StudentReportType } from '@/services/student-reports';

const TABS: { id: StudentReportType; label: string; mode?: 'distribution' | 'combinations' }[] = [
  { id: 'department', label: 'Department Strength' },
  { id: 'major-subjects', label: 'Major Subjects' },
  { id: 'combinations', label: 'Subject Combinations', mode: 'combinations' },
];

export default function DepartmentReportsPage() {
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
        title="Department Reports"
        description="Department strength, major/minor distribution, and subject combination analysis."
        reportType={tab.id}
        mode={tab.mode ?? 'distribution'}
      />
    </div>
  );
}
