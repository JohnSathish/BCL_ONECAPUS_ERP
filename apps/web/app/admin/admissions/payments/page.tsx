import { AdmissionsApplicationsControlCenter } from '@/components/admissions-module/admissions-applications-control-center';

export default function AdminAdmissionsPaymentsPage() {
  return (
    <AdmissionsApplicationsControlCenter
      preset={{
        title: 'Payment verification',
        description: 'Submitted applications with application fee not yet confirmed.',
        paymentPending: true,
      }}
    />
  );
}
