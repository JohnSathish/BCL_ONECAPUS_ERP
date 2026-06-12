import { StudentReportSectionPage } from '@/components/student-reports/student-report-section-page';

export default function AdmissionReportsPage() {
  return (
    <StudentReportSectionPage
      title="Admission Reports"
      description="Admission status, type, and academic year enrollment analysis."
      reportType="admission"
    />
  );
}
