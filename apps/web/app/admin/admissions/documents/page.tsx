import { AdmissionsApplicationsControlCenter } from '@/components/admissions-module/admissions-applications-control-center';

export default function AdminAdmissionsDocumentsPage() {
  return (
    <AdmissionsApplicationsControlCenter
      preset={{
        title: 'Document verification',
        description: 'Submitted applications with documents still pending verification.',
        documentPending: true,
      }}
    />
  );
}
