'use client';

import { Eye, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  canManage: boolean;
  isDirty: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  onPreview: () => void;
  onReset: () => void;
  onSave: () => void;
};

export function BrandingPageHeader({
  canManage,
  isDirty,
  isSaving,
  saveSuccess,
  onPreview,
  onReset,
  onSave,
}: Props) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Theme Studio</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Premium SaaS skin system for your college ERP: flagship themes, typography, density,
          accessibility, branding, and live preview in one command center.
        </p>
        {saveSuccess ? (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400" role="status">
            Theme & branding saved successfully.
          </p>
        ) : null}
        {!canManage ? (
          <p className="text-sm text-muted-foreground">
            View only — institution or super admins can edit branding.
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onPreview}>
          <Eye className="mr-2 h-4 w-4" />
          Preview Branding
        </Button>
        <Button type="button" variant="outline" disabled={!canManage || !isDirty} onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button type="button" disabled={!canManage || isSaving || !isDirty} onClick={onSave}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
