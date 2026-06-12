import { PlatformPortalGuard } from '@/components/platform/platform-portal-guard';
import { PlatformShell } from '@/components/platform/platform-shell';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformPortalGuard>
      <PlatformShell>{children}</PlatformShell>
    </PlatformPortalGuard>
  );
}
