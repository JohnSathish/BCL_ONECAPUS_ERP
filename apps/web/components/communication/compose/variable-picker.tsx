'use client';

import { MESSAGE_VARIABLES } from '@/components/communication/comm-center-nav';
import { Button } from '@/components/ui/button';

export function VariablePicker({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Insert variable</p>
      <div className="flex flex-wrap gap-1.5">
        {MESSAGE_VARIABLES.map((v) => (
          <Button
            key={v.key}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onInsert(`{{${v.key}}}`)}
          >
            {v.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
