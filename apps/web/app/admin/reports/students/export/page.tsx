'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import {
  emptyReportFilters,
  StudentReportFiltersBar,
  toApiFilters,
} from '@/components/student-reports/student-report-filters';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import { useStudentReportFilterOptions } from '@/components/student-reports/use-student-report-filters';
import { exportStudentReport, type StudentReportType } from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';

const EXPORT_CATALOG: { type: StudentReportType; label: string; description: string }[] = [
  {
    type: 'dashboard',
    label: 'Dashboard Summary',
    description: 'KPIs and top-level distributions',
  },
  {
    type: 'strength',
    label: 'Institution Strength',
    description: 'Programme, semester, shift counts',
  },
  {
    type: 'department',
    label: 'Department Strength',
    description: 'Department and major/minor counts',
  },
  { type: 'gender', label: 'Gender Report', description: 'Gender distribution and ratio' },
  { type: 'category', label: 'Category Report', description: 'ST/SC/OBC/General/EWS breakdown' },
  { type: 'religion', label: 'Religion Report', description: 'Religion-wise strength' },
  { type: 'denomination', label: 'Denomination Report', description: 'Denomination statistics' },
  { type: 'combinations', label: 'Subject Combinations', description: 'Major + minor pair counts' },
  { type: 'mdc', label: 'MDC Enrollment', description: 'Multidisciplinary course choices' },
  { type: 'aec', label: 'AEC Enrollment', description: 'Ability enhancement choices' },
  { type: 'sec', label: 'SEC Enrollment', description: 'Skill enhancement choices' },
  { type: 'vac', label: 'VAC Enrollment', description: 'Value added course choices' },
  { type: 'age', label: 'Age Analysis', description: 'Age distribution histogram' },
  { type: 'blood-group', label: 'Blood Group', description: 'Blood group distribution' },
  { type: 'admission', label: 'Admission Summary', description: 'Admission status and types' },
  { type: 'contact', label: 'Contact Summary', description: 'Mobile and email coverage' },
];

export default function ExportCenterPage() {
  const [filters, setFilters] = useState(emptyReportFilters);
  const [message, setMessage] = useState('');
  const filterOptions = useStudentReportFilterOptions();
  const apiFilters = toApiFilters(filters);

  const exportMut = useMutation({
    mutationFn: ({ type, format }: { type: StudentReportType; format: 'xlsx' | 'csv' }) =>
      exportStudentReport(type, format, apiFilters),
    onSuccess: () => setMessage('Export started — check your downloads.'),
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
  });

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Export Center"
        description="Bulk export predefined student reports to Excel or CSV."
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          {...filterOptions}
        />

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORT_CATALOG.map((item) => (
            <CompactCard key={item.type}>
              <CompactCardHeader title={item.label} description={item.description} />
              <CompactCardBody className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exportMut.isPending}
                  onClick={() => exportMut.mutate({ type: item.type, format: 'xlsx' })}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={exportMut.isPending}
                  onClick={() => exportMut.mutate({ type: item.type, format: 'csv' })}
                >
                  CSV
                </Button>
              </CompactCardBody>
            </CompactCard>
          ))}
        </div>
      </StudentReportsShell>
    </DashboardShell>
  );
}
