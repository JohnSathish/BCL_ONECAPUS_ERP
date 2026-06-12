'use client';

import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
};

export function QueryErrorPanel({
  title = 'Unable to load data',
  message,
  error,
  onRetry,
  isRetrying,
}: Props) {
  const detail = message ?? (error ? apiErrorMessage(error, 'Request failed') : 'Request failed');

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      <p className="mt-1 text-muted-foreground">{detail}</p>
      {onRetry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs"
          disabled={isRetrying}
          onClick={onRetry}
        >
          {isRetrying ? 'Retrying…' : 'Retry'}
        </Button>
      ) : null}
    </div>
  );
}
