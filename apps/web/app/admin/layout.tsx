import { SchoolAwareAdminLayout } from '@/components/school-office/school-aware-admin-layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SchoolAwareAdminLayout>{children}</SchoolAwareAdminLayout>;
}
