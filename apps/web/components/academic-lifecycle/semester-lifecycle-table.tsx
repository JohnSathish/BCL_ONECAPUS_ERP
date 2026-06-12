'use client';

import { DataTable, type DataTableColumn } from '@/components/erp/data-table';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import type { CycleDashboard } from '@/types/academic-lifecycle';

type Row = CycleDashboard['semesterLifecycle'][number];

const lifecycleColumns: DataTableColumn<Row>[] = [
  {
    key: 'semesterNumber',
    header: 'Semester',
    cell: (r) => `Sem ${r.semesterNumber}`,
  },
  { key: 'cycle', header: 'Cycle', cell: (r) => r.cycle },
  {
    key: 'isActive',
    header: 'Active',
    cell: (r) => (r.isActive ? 'Yes' : 'No'),
  },
  { key: 'studentCount', header: 'Students', cell: (r) => r.studentCount },
  {
    key: 'registrationOpen',
    header: 'Registration',
    cell: (r) => (r.registrationOpen ? 'Open' : 'Closed'),
  },
  {
    key: 'frozen',
    header: 'Freeze',
    cell: (r) => (r.frozen ? 'Frozen' : '—'),
  },
];

type Props = {
  rows: Row[];
};

export function SemesterLifecycleTable({ rows }: Props) {
  return (
    <CompactCard>
      <CompactCardHeader
        title="Semester lifecycle"
        description="Programme semesters 1–6. Multiple semesters may be active in parallel."
      />
      <CompactCardBody>
        <DataTable
          columns={lifecycleColumns}
          rows={rows}
          getRowKey={(r) => r.id}
          emptyMessage="Select an institution to view semester lifecycle."
        />
      </CompactCardBody>
    </CompactCard>
  );
}
