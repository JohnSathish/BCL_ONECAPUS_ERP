import { StudentReportSectionPage } from '@/components/student-reports/student-report-section-page';

export default function ContactReportsPage() {
  return (
    <StudentReportSectionPage
      title="Contact Reports"
      description="Mobile and email coverage across the student population."
      reportType="contact"
    />
  );
}
