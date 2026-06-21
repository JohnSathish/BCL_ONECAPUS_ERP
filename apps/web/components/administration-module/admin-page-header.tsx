'use client';

import { ImpersonationBanner } from '@/components/administration-module/impersonation-banner';
import { useErpPageLayout } from '@/components/layout/erp-page-layout';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { cn } from '@/utils/cn';

export function AdminPageHeader({
  title,
  subtitle,
  actions,
  showTitle = true,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Hide h1 when DashboardShell already renders the page title. */
  showTitle?: boolean;
  className?: string;
}) {
  const { isImpersonating } = useAdminPermissions();
  const { shellTitle } = useErpPageLayout();
  const duplicateShellTitle = Boolean(shellTitle && shellTitle === title);
  const renderTitle = showTitle && !duplicateShellTitle;

  return (
    <div className={cn('erp-admin-page-header mb-5 space-y-4', className)}>
      {isImpersonating ? <ImpersonationBanner /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {renderTitle ? (
            <h1 className="text-xl font-semibold leading-snug tracking-tight text-balance sm:text-2xl">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              className={cn(
                'max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty',
                renderTitle ? 'mt-1.5' : '',
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
