'use client';

import { Button } from '@/components/ui/button';

type Props = {
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
};

export function ApiConnectivityBanner({
  message = 'API server unavailable. Some dashboard sections may not load.',
  onRetry,
  isRetrying,
}: Props) {
  return (
    <div
      className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
      role="alert"
    >
      <p className="font-medium text-amber-900 dark:text-amber-100">Connection issue</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs"
          disabled={isRetrying}
          onClick={onRetry}
        >
          {isRetrying ? 'Checking…' : 'Check again'}
        </Button>
      ) : null}
    </div>
  );
}
