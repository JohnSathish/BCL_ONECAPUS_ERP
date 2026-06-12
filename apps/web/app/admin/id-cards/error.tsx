'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, isApiUnavailableError } from '@/utils/api-error';

export default function IdCardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[id-cards]', error);
  }, [error]);

  const unavailable = isApiUnavailableError(error);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">
        {unavailable ? 'API server unavailable' : 'Something went wrong'}
      </h2>
      <p className="text-sm text-muted-foreground">
        {unavailable
          ? 'The backend may still be starting after a code change. Wait a few seconds, then try again.'
          : apiErrorMessage(error, 'An unexpected error occurred in the ID Cards module.')}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/id-cards">Back to ID Cards</Link>
        </Button>
      </div>
      {unavailable ? (
        <p className="text-xs text-muted-foreground">
          If this persists, confirm <code className="rounded bg-muted px-1">npm run dev</code> is
          running (API on port 3001, web on 3000).
        </p>
      ) : null}
    </div>
  );
}
