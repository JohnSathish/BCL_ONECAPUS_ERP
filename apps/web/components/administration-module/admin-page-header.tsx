'use client';

import { ImpersonationBanner } from '@/components/administration-module/impersonation-banner';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const { isImpersonating } = useAdminPermissions();
  return (
    <div className="mb-6 space-y-4">
      {isImpersonating ? <ImpersonationBanner /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
