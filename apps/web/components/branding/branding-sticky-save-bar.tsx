'use client';

import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type Props = {
  visible: boolean;
  canManage: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

export function BrandingStickySaveBar({ visible, canManage, isSaving, onSave, onDiscard }: Props) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-md transition-transform duration-300 sm:px-6',
        visible ? 'translate-y-0' : 'translate-y-full pointer-events-none',
      )}
      role="region"
      aria-label="Unsaved branding changes"
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-foreground">You have unsaved branding changes</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={!canManage} onClick={onDiscard}>
            Discard
          </Button>
          <Button type="button" disabled={!canManage || isSaving} onClick={onSave}>
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
    </div>
  );
}
