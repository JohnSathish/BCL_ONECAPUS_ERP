'use client';

import { useCallback, useState } from 'react';
import { StepUpDialog } from '@/components/auth/step-up-dialog';

export function useStepUpAction(options?: { title?: string; description?: string }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<((stepUpToken: string) => void | Promise<void>) | null>(
    null,
  );

  const withStepUp = useCallback((run: (stepUpToken: string) => void | Promise<void>) => {
    setAction(() => run);
    setOpen(true);
  }, []);

  const stepUpDialog = (
    <StepUpDialog
      open={open}
      onOpenChange={setOpen}
      title={options?.title}
      description={options?.description}
      onVerified={async (token) => {
        if (action) await action(token);
        setAction(null);
      }}
    />
  );

  return { withStepUp, stepUpDialog };
}
