'use client';

import { AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { fetchLicenseSummary } from '@/services/licensing';
import { cn } from '@/utils/cn';

export function LicenseAlertBanner() {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const canView = canAny('license:read', 'tenant:manage', 'users:manage');

  const summary = useQuery({
    queryKey: ['license', 'summary'],
    queryFn: fetchLicenseSummary,
    staleTime: 60_000,
    enabled: enabled && canView,
  });

  if (!canView || !summary.data?.showMarquee || !summary.data.alertMessage) return null;

  const critical =
    summary.data.status === 'EXPIRED' ||
    summary.data.status === 'SUSPENDED' ||
    summary.data.status === 'GRACE_PERIOD';

  return (
    <div
      id="erp-license-banner"
      className={cn(
        'relative z-[calc(var(--erp-z-topbar,40)-1)] shrink-0 overflow-hidden border-b text-sm',
        critical
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100',
      )}
    >
      <div className="flex items-center gap-2 py-2">
        <AlertTriangle className="ml-4 h-4 w-4 shrink-0" />
        <div className="license-marquee flex-1 overflow-hidden whitespace-nowrap">
          <span className="license-marquee-track inline-block px-4">
            {summary.data.alertMessage} — Contact BaseCode Labs Pvt. Ltd. at 9566363655 or
            contact@basecodelabs.com
            {' · '}
            {summary.data.alertMessage} — Contact BaseCode Labs Pvt. Ltd. at 9566363655 or
            contact@basecodelabs.com
          </span>
        </div>
      </div>
      <style jsx>{`
        .license-marquee-track {
          animation: license-marquee 28s linear infinite;
        }
        @keyframes license-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
