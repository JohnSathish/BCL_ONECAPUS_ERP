'use client';

import Link from 'next/link';

import { DataTable } from '@/components/erp/data-table';
import { buttonVariants } from '@/components/ui/button';
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';
import { formatShortDate } from '@/utils/format-date';

type Props = {
  rows: StudentDirectoryRow[];
  canManage?: boolean;
  onDelete?: (row: StudentDirectoryRow) => void;
  deletePending?: boolean;
};

function StatusBadge({ label }: { label: string }) {
  const tone =
    label === 'Alumni'
      ? 'bg-purple-100 text-purple-800'
      : label === 'Dropped'
        ? 'bg-red-100 text-red-800'
        : label === 'Promoted'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-blue-100 text-blue-800';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>{label}</span>
  );
}

export function StudentDirectoryTable({ rows, canManage, onDelete, deletePending }: Props) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(s) => s.id}
      canManage={Boolean(canManage)}
      deletePending={deletePending}
      onDelete={onDelete}
      emptyMessage="No students match the current filters."
      columns={[
        {
          key: 'id',
          header: 'Reg / Roll',
          className: 'w-[14%]',
          cell: (s: StudentDirectoryRow) => (
            <div>
              <p className="font-medium text-xs">{s.enrollmentNumber}</p>
              {s.rollNumber ? (
                <p className="text-[10px] text-muted-foreground">Roll {s.rollNumber}</p>
              ) : null}
            </div>
          ),
        },
        {
          key: 'name',
          header: 'Name',
          className: 'w-[18%]',
          cell: (s) => (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{s.fullName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{s.email}</p>
            </div>
          ),
        },
        {
          key: 'programme',
          header: 'Programme',
          className: 'w-[14%]',
          cell: (s) => <span className="truncate text-xs">{s.programme ?? '—'}</span>,
        },
        {
          key: 'semester',
          header: 'Sem',
          className: 'w-[8%]',
          cell: (s) => (
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px]">
              Sem {s.semester}
            </span>
          ),
        },
        {
          key: 'stream',
          header: 'Stream / Shift',
          className: 'w-[14%]',
          cell: (s) => (
            <div className="text-xs">
              <p>{s.stream ?? '—'}</p>
              <p className="text-[10px] text-muted-foreground">{s.shift ?? '—'}</p>
            </div>
          ),
        },
        {
          key: 'batch',
          header: 'Batch',
          className: 'w-[10%]',
          cell: (s) => <span className="text-xs">{s.batch ?? '—'}</span>,
        },
        {
          key: 'status',
          header: 'Status',
          className: 'w-[12%]',
          cell: (s) => <StatusBadge label={s.academicStatus} />,
        },
        {
          key: 'actions',
          header: 'Actions',
          className: 'w-[10%]',
          cell: (s) => (
            <Link
              href={`/admin/students/${s.id}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs')}
            >
              View
            </Link>
          ),
        },
        {
          key: 'admitted',
          header: 'Admitted',
          className: 'w-[10%] hidden lg:table-cell',
          cell: (s) => (
            <span className="text-xs text-muted-foreground">
              {formatShortDate(s.admissionDate)}
            </span>
          ),
        },
      ]}
    />
  );
}
