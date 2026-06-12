'use client';

import { DataTable, type DataTableColumn } from '@/components/erp/data-table';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import type { CycleDashboard } from '@/types/academic-lifecycle';

type Row = CycleDashboard['batchProgression'][number];

const batchColumns: DataTableColumn<Row>[] = [
  { key: 'batchCode', header: 'Batch', cell: (r) => r.batchCode },
  { key: 'admissionYear', header: 'Year', cell: (r) => r.admissionYear },
  { key: 'entrySession', header: 'Entry session', cell: (r) => r.entrySession },
  {
    key: 'currentSemester',
    header: 'Current sem',
    cell: (r) => `Sem ${r.currentSemester}`,
  },
  { key: 'cycleType', header: 'Cycle', cell: (r) => r.cycleType },
  { key: 'promotionStatus', header: 'Promotion', cell: (r) => r.promotionStatus },
  { key: 'studentCount', header: 'Students', cell: (r) => r.studentCount },
];

type Props = {
  rows: Row[];
};

export function BatchProgressionTable({ rows }: Props) {
  return (
    <CompactCard>
      <CompactCardHeader
        title="Batch progression"
        description="Cohort semester mapping — source of truth per batch."
      />
      <CompactCardBody>
        <DataTable
          columns={batchColumns}
          rows={rows}
          getRowKey={(r) => r.id}
          emptyMessage="No admission batches configured."
        />
      </CompactCardBody>
    </CompactCard>
  );
}
