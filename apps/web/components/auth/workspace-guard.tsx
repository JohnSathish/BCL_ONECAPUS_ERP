'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { canSwitchWorkspace, shouldShowWorkspacePicker } from '@/lib/workspace/workspace-utils';

const PICKER_PATH = '/admin/workspace';

export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useWorkspaceStore((s) => s.hasHydrated);
  const hasSelectedWorkspace = useWorkspaceStore((s) => s.hasSelectedWorkspace);
  const user = session?.user;

  const needsPicker =
    hasHydrated &&
    user &&
    canSwitchWorkspace(user) &&
    shouldShowWorkspacePicker(user, hasSelectedWorkspace);

  useEffect(() => {
    if (!needsPicker) return;
    if (pathname === PICKER_PATH) return;
    router.replace(PICKER_PATH);
  }, [needsPicker, pathname, router]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  if (needsPicker && pathname !== PICKER_PATH) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Opening workspace picker…
      </div>
    );
  }

  return <>{children}</>;
}
