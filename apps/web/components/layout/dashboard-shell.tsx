'use client';

import { motion } from 'framer-motion';
import { EnterpriseSidebar } from '@/components/layout/enterprise-sidebar';
import { EnterpriseTopbar } from '@/components/layout/enterprise-topbar';
import { LicenseAlertBanner } from '@/components/licensing/license-alert-banner';
import { LicenseWriteBlockedBanner } from '@/components/licensing/license-write-blocked-banner';
import { StaffMobileBottomNav } from '@/components/staff-portal/layout/staff-mobile-bottom-nav';
import { StudentMobileBottomNav } from '@/components/student-portal/layout/student-mobile-bottom-nav';
import { ROLE_NAV } from '@/config/navigation';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { cn } from '@/utils/cn';

type Role = keyof typeof ROLE_NAV | 'admin' | 'shift' | 'staff';

export function DashboardShell({
  role = 'admin',
  title,
  children,
}: {
  role?: Role;
  title?: string;
  children: React.ReactNode;
}) {
  const collapsed = useDashboardUiStore((s) => s.sidebarCollapsed);

  if (role === 'admin') {
    return (
      <>
        <EnterpriseTopbar title={title} portalRole="admin" />
        <LicenseAlertBanner />
        <LicenseWriteBlockedBanner />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 pb-20 sm:px-5 md:pb-4 lg:px-6"
        >
          <div className="w-full max-w-full min-w-0">{children}</div>
        </motion.main>
      </>
    );
  }

  return (
    <motion.div className="flex h-screen w-full max-w-full overflow-hidden bg-background">
      <EnterpriseSidebar role={role} />

      <div
        className={cn(
          'relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          collapsed ? 'md:pl-[72px]' : 'md:pl-[260px] lg:pl-[280px]',
        )}
      >
        <EnterpriseTopbar
          title={title}
          portalRole={role === 'student' || role === 'staff' ? role : undefined}
        />

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            'min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-5 lg:px-6',
            (role === 'staff' || role === 'student') && 'pb-20 md:pb-4',
          )}
        >
          <div className="w-full max-w-full min-w-0">{children}</div>
        </motion.main>

        {role === 'staff' ? <StaffMobileBottomNav /> : null}
        {role === 'student' ? <StudentMobileBottomNav /> : null}
      </div>
    </motion.div>
  );
}
