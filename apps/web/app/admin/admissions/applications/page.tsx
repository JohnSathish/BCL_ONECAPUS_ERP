import { AdmissionsApplicationsControlCenter } from '@/components/admissions-module/admissions-applications-control-center';

export default function AdminAdmissionsApplicationsPage() {
  return (
    <AdmissionsApplicationsControlCenter
      preset={{
        title: 'Application form',
        description: 'All portal applications with fees, documents, and admission actions.',
      }}
    />
  );
}
