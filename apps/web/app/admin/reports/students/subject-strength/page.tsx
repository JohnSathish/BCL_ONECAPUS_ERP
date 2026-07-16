'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileText, Printer } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StudentReportFiltersBar } from '@/components/student-reports/student-report-filters';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import {
  useStudentReportFilterOptions,
  useStudentReportFilterState,
} from '@/components/student-reports/use-student-report-filters';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import {
  exportSubjectStrengthReport,
  fetchDepartmentStrengthReport,
  fetchDepartmentStrengthStudents,
  fetchDepartmentSubjectSummaryReport,
  fetchSubjectStrengthReport,
  type DepartmentStrengthRow,
  type SubjectStrengthExportVariant,
} from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type HubTab = 'department' | 'subject' | 'department-summary';

const TABS: { id: HubTab; label: string }[] = [
  { id: 'department', label: 'Department-wise' },
  { id: 'subject', label: 'Subject-wise Enrollment' },
  { id: 'department-summary', label: 'Department + Subject' },
];

export default function SubjectStrengthReportPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const { filters, patchFilters, apiFilters, hideShiftFilter } = useStudentReportFilterState();
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<HubTab>('department');
  const [drillRow, setDrillRow] = useState<DepartmentStrengthRow | null>(null);
  const filterOptions = useStudentReportFilterOptions();

  const enabled = Boolean(session) && perms.canRead;

  const departmentReport = useQuery({
    queryKey: ['student-reports', 'subject-strength-department', apiFilters],
    queryFn: () => fetchDepartmentStrengthReport(apiFilters),
    enabled: enabled && tab === 'department',
  });

  const subjectReport = useQuery({
    queryKey: ['student-reports', 'subject-strength', apiFilters],
    queryFn: () => fetchSubjectStrengthReport(apiFilters),
    enabled: enabled && tab === 'subject',
  });

  const summaryReport = useQuery({
    queryKey: ['student-reports', 'subject-strength-department-summary', apiFilters],
    queryFn: () => fetchDepartmentSubjectSummaryReport(apiFilters),
    enabled: enabled && tab === 'department-summary',
  });

  const studentsReport = useQuery({
    queryKey: [
      'student-reports',
      'subject-strength-department-students',
      apiFilters,
      drillRow?.majorSubjectId,
      drillRow?.departmentId,
    ],
    queryFn: () =>
      fetchDepartmentStrengthStudents({
        ...apiFilters,
        majorSubjectId: drillRow!.majorSubjectId,
        departmentId: drillRow?.departmentId ?? undefined,
      }),
    enabled: enabled && Boolean(drillRow?.majorSubjectId),
  });

  const exportVariant = useMemo<SubjectStrengthExportVariant>(() => {
    if (tab === 'subject') return 'subject';
    if (tab === 'department-summary') return 'department-summary';
    return 'department';
  }, [tab]);

  const exportMut = useMutation({
    mutationFn: (format: 'xlsx' | 'csv' | 'pdf') =>
      exportSubjectStrengthReport(format, apiFilters, exportVariant),
    onSuccess: () => setMessage('Report exported.'),
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
  });

  const studentsExportMut = useMutation({
    mutationFn: (format: 'xlsx' | 'csv' | 'pdf') =>
      exportSubjectStrengthReport(
        format,
        {
          ...apiFilters,
          majorSubjectId: drillRow?.majorSubjectId,
          departmentId: drillRow?.departmentId ?? undefined,
        },
        'department-students',
      ),
    onSuccess: () => setMessage('Student list exported.'),
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
  });

  const loading =
    (tab === 'department' && departmentReport.isLoading) ||
    (tab === 'subject' && subjectReport.isLoading) ||
    (tab === 'department-summary' && summaryReport.isLoading);

  const deptData = departmentReport.data;

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Subject Strength Reports"
        description="Department-wise strength for Principal/HODs, subject-wise enrollment, and department + subject summaries."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportMut.isPending}
              onClick={() => exportMut.mutate('pdf')}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportMut.isPending}
              onClick={() => exportMut.mutate('xlsx')}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exportMut.isPending}
              onClick={() => exportMut.mutate('csv')}
            >
              CSV
            </Button>
          </>
        }
      >
        <div className="space-y-4 pb-8">
          <div className="flex flex-wrap gap-2 print:hidden">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium',
                  tab === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <StudentReportFiltersBar
            filters={filters}
            onChange={patchFilters}
            hideShiftFilter={hideShiftFilter}
            {...filterOptions}
          />

          {message ? <p className="text-sm text-muted-foreground print:hidden">{message}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading report…</p> : null}

          {tab === 'department' ? (
            <>
              {departmentReport.isError ? (
                <p className="text-sm text-destructive">
                  {apiErrorMessage(departmentReport.error, 'Failed to load department strength')}
                </p>
              ) : null}

              {deptData ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
                  <SummaryCard label="Semester" value={deptData.semesterLabel ?? 'All'} />
                  <SummaryCard
                    label="Total Departments"
                    value={deptData.summary.totalDepartments.toLocaleString()}
                  />
                  <SummaryCard
                    label="Total Students"
                    value={deptData.summary.totalStudents.toLocaleString()}
                  />
                  <SummaryCard label="Tip" value="Click a row to view students" muted />
                </div>
              ) : null}

              {deptData && deptData.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No department strength found for the selected filters.
                </p>
              ) : null}

              {deptData && deptData.rows.length > 0 ? (
                <CompactCard className="print:break-inside-avoid">
                  <CompactCardHeader
                    title={deptData.title}
                    description={[
                      deptData.academicYearLabel
                        ? `Academic Year: ${deptData.academicYearLabel}`
                        : null,
                      deptData.semesterLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                  <CompactCardBody>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 font-medium">Department</th>
                            <th className="pb-2 font-medium">Major Subject</th>
                            <th className="pb-2 text-right font-medium">Total Students</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deptData.rows.map((row) => (
                            <tr
                              key={`${row.departmentId ?? row.departmentName}-${row.majorSubjectId}`}
                              className="cursor-pointer border-b border-border/40 hover:bg-muted/40"
                              onClick={() => setDrillRow(row)}
                            >
                              <td className="py-2">{row.departmentName}</td>
                              <td className="py-2">{row.majorSubjectName}</td>
                              <td className="py-2 text-right tabular-nums font-medium text-primary">
                                {row.studentCount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t font-semibold">
                            <td className="pt-2" colSpan={2}>
                              Total Students
                            </td>
                            <td className="pt-2 text-right tabular-nums">
                              {deptData.summary.totalStudents.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CompactCardBody>
                </CompactCard>
              ) : null}
            </>
          ) : null}

          {tab === 'subject' ? (
            <>
              {subjectReport.isError ? (
                <p className="text-sm text-destructive">
                  {apiErrorMessage(subjectReport.error, 'Failed to load subject enrollment')}
                </p>
              ) : null}
              {subjectReport.data?.semesters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No subject enrollments found for the selected filters.
                </p>
              ) : null}
              {subjectReport.data?.semesters.map((sem) => (
                <CompactCard key={sem.semesterSequence} className="print:break-inside-avoid">
                  <CompactCardHeader
                    title={sem.label}
                    description={`${sem.totalStudents.toLocaleString()} students with at least one subject`}
                  />
                  <CompactCardBody>
                    <ul className="space-y-1.5 text-sm">
                      {sem.categories.flatMap((cat) =>
                        cat.subjects.map((sub) => (
                          <li
                            key={`${sem.semesterSequence}-${cat.category}-${sub.offeringId}`}
                            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 py-1.5 last:border-0"
                          >
                            <span>
                              <span className="font-medium">{cat.label}</span>
                              <span className="text-muted-foreground"> – </span>
                              <span>{sub.courseTitle}</span>
                              {sub.courseCode ? (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  ({sub.courseCode})
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums font-medium">
                              {sub.studentCount.toLocaleString()} Students
                            </span>
                          </li>
                        )),
                      )}
                    </ul>
                  </CompactCardBody>
                </CompactCard>
              ))}
            </>
          ) : null}

          {tab === 'department-summary' ? (
            <>
              {summaryReport.isError ? (
                <p className="text-sm text-destructive">
                  {apiErrorMessage(summaryReport.error, 'Failed to load department summary')}
                </p>
              ) : null}
              {summaryReport.data?.departments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No department subject summary found for the selected filters.
                </p>
              ) : null}
              {summaryReport.data?.departments.map((dept) => (
                <CompactCard
                  key={dept.departmentId ?? dept.departmentName}
                  className="print:break-inside-avoid"
                >
                  <CompactCardHeader
                    title={`${dept.departmentName} Department`}
                    description={summaryReport.data?.semesterLabel ?? undefined}
                  />
                  <CompactCardBody>
                    <ul className="space-y-1.5 text-sm">
                      {dept.lines.map((line) => (
                        <li
                          key={`${dept.departmentId}-${line.category}-${line.courseCode}-${line.label}`}
                          className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 py-1.5 last:border-0"
                        >
                          <span>
                            <span className="font-medium">{line.label}</span>
                            {line.courseCode ? (
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                ({line.courseCode})
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 tabular-nums font-medium">
                            {line.studentCount.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CompactCardBody>
                </CompactCard>
              ))}
            </>
          ) : null}
        </div>
      </StudentReportsShell>

      <Dialog open={Boolean(drillRow)} onOpenChange={(open) => !open && setDrillRow(null)}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden p-0">
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>
                {drillRow
                  ? `${drillRow.departmentName} – ${drillRow.studentCount.toLocaleString()} students`
                  : 'Students'}
              </DialogTitle>
              <DialogDescription>
                {drillRow?.majorSubjectName}
                {deptData?.semesterLabel ? ` · ${deptData.semesterLabel}` : ''}
              </DialogDescription>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={studentsExportMut.isPending}
                  onClick={() => studentsExportMut.mutate('xlsx')}
                >
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={studentsExportMut.isPending}
                  onClick={() => studentsExportMut.mutate('csv')}
                >
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={studentsExportMut.isPending}
                  onClick={() => studentsExportMut.mutate('pdf')}
                >
                  PDF
                </Button>
              </div>
            </DialogHeader>
            <div className="overflow-auto px-6 py-4">
              {studentsReport.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading students…</p>
              ) : null}
              {studentsReport.isError ? (
                <p className="text-sm text-destructive">
                  {apiErrorMessage(studentsReport.error, 'Failed to load students')}
                </p>
              ) : null}
              {studentsReport.data ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Student ID</th>
                      <th className="pb-2 font-medium">Roll Number</th>
                      <th className="pb-2 font-medium">Student Name</th>
                      <th className="pb-2 font-medium">Major Department</th>
                      <th className="pb-2 font-medium">Minor Department</th>
                      <th className="pb-2 font-medium">Mobile</th>
                      <th className="pb-2 font-medium">Admission Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsReport.data.students.map((s) => (
                      <tr key={s.studentId} className="border-b border-border/40">
                        <td className="py-1.5 tabular-nums">{s.enrollmentNumber}</td>
                        <td className="py-1.5 tabular-nums">{s.rollNumber || '—'}</td>
                        <td className="py-1.5">{s.fullName}</td>
                        <td className="py-1.5">{s.majorDepartment || '—'}</td>
                        <td className="py-1.5">{s.minorDepartment || '—'}</td>
                        <td className="py-1.5 tabular-nums">{s.mobileNumber || '—'}</td>
                        <td className="py-1.5">{s.admissionStatus || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function SummaryCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold',
          muted && 'text-sm font-medium text-muted-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}
