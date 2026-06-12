'use client';

import { DataTable, type DataTableColumn } from '@/components/erp/data-table';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import type { PromotionLogRow } from '@/types/academic-lifecycle';
import { formatDisplayDateTime } from '@/utils/format-date';

const logColumns: DataTableColumn<PromotionLogRow>[] = [
  {
    key: 'createdAt',
    header: 'When',
    cell: (r) => formatDisplayDateTime(r.createdAt),
  },
  { key: 'action', header: 'Action', cell: (r) => r.action },
  {
    key: 'run',
    header: 'From → To',
    cell: (r) => (r.run ? `Sem ${r.run.fromSequence} → ${r.run.toSemesterSequence}` : '—'),
  },
  {
    key: 'batch',
    header: 'Batch',
    cell: (r) => r.run?.admissionBatch?.batchCode ?? '—',
  },
  {
    key: 'actor',
    header: 'By',
    cell: (r) => r.actor?.email ?? r.run?.appliedBy?.email ?? '—',
  },
];

type Props = {
  rows: PromotionLogRow[];
};

export function PromotionLogsTable({ rows }: Props) {
  return (
    <CompactCard>
      <CompactCardHeader
        title="Promotion logs"
        description="Audit trail for promotion runs and cycle rollovers."
      />
      <CompactCardBody>
        <DataTable
          columns={logColumns}
          rows={rows}
          getRowKey={(r) => r.id}
          emptyMessage="No promotion activity yet."
        />
      </CompactCardBody>
    </CompactCard>
  );
}
