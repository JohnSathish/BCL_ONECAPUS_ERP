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
  const raw = message ?? (error ? apiErrorMessage(error, 'Request failed') : 'Request failed');
  // Prefer user-safe copy — strip permission slug dumps from ForbiddenException text.
  const detail = /Missing required permissions|Requires one of:/i.test(raw)
    ? 'You do not have permission to view this data. Ask an administrator if you need access.'
    : raw;

  return (
    <div
      className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
      role="alert"
    >
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
