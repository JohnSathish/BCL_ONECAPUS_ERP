import { AdmissionsApplicationsControlCenter } from '@/components/admissions-module/admissions-applications-control-center';

export default function AdminAdmissionsAdmittedPage() {
  return (
    <AdmissionsApplicationsControlCenter
      preset={{
        title: 'Admitted students',
        description: 'Allotted applications ready for enrollment into student records.',
        admittedOnly: true,
      }}
    />
  );
}
