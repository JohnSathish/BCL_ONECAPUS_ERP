'use client';

import { Button } from '@/components/ui/button';

type Props = {
  isPending: boolean;
  onExport: (params: {
    format: 'csv' | 'xlsx';
    reportType: 'audit' | 'missing-setup' | 'nep-compliance';
  }) => void;
};

export function CompletionExportMenu({ onExport, isPending }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => onExport({ format: 'csv', reportType: 'audit' })}
      >
        Export audit (CSV)
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => onExport({ format: 'csv', reportType: 'missing-setup' })}
      >
        Missing setup (CSV)
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => onExport({ format: 'xlsx', reportType: 'nep-compliance' })}
      >
        NEP compliance (XLSX)
      </Button>
    </div>
  );
}
