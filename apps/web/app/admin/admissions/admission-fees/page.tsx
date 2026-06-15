import { AdmissionsApplicationsControlCenter } from '@/components/admissions-module/admissions-applications-control-center';

export default function AdminAdmissionsAdmissionFeesPage() {
  return (
    <AdmissionsApplicationsControlCenter
      preset={{
        title: 'Admission fee verification',
        description: 'Allotted applicants with admission fee still pending.',
        admissionFeePending: true,
      }}
    />
  );
}
