import { StaffPortalGuard } from '@/components/auth/staff-portal-guard';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffPortalGuard>{children}</StaffPortalGuard>;
}
