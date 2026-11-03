'use client';

import { ArrowDown, ArrowUp, Check, Columns3 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
  CirculationDepartmentRow,
  CirculationIncidentRow,
  CirculationLibrarianRow,
  CirculationLoanRow,
  CirculationReportKey,
  CirculationRowsResponse,
  CirculationTransactionRow,
} from '@/types/library-circulation-report';
import { cn } from '@/utils/cn';

const TZ = 'Asia/Kolkata';

export function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function fmtDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

function money(value?: number | null) {
  return value == null || value === 0 ? '—' : `₹${value.toFixed(2)}`;
}

const STATUS_TONE: Record<string, string> = {
  ON_LOAN: 'bg-sky-50 text-sky-700',
  OVERDUE: 'bg-rose-50 text-rose-700',
  RETURNED: 'bg-emerald-50 text-emerald-700',
  RENEWED: 'bg-violet-50 text-violet-700',
  RETURNED_LATE: 'bg-amber-50 text-amber-800',
  RETURNED_DAMAGED: 'bg-orange-50 text-orange-700',
  LOST: 'bg-rose-100 text-rose-800',
};

function Pill({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        tone ?? 'bg-slate-100 text-slate-700',
      )}
    >
      {children}
    </span>
  );
}

type Column<T> = {
  key: string;
  label: string;
  sortKey?: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

const TXN_COLUMNS: Column<CirculationTransactionRow>[] = [
  {
    key: 'transactionId',
    label: 'Transaction ID',
    sortKey: 'transactionId',
    cell: (r) => <span className="font-mono text-xs">{r.transactionId}</span>,
  },
  {
    key: 'occurredAt',
    label: 'Date & Time',
    sortKey: 'occurredAt',
    cell: (r) => fmtDateTime(r.occurredAt),
    className: 'whitespace-nowrap',
  },
  {
    key: 'type',
    label: 'Type',
    sortKey: 'type',
    cell: (r) => (
      <Pill
        tone={
          r.type === 'ISSUE'
            ? 'bg-blue-50 text-blue-700'
            : r.type === 'RENEW'
              ? 'bg-violet-50 text-violet-700'
              : 'bg-emerald-50 text-emerald-700'
        }
      >
        {r.typeLabel}
      </Pill>
    ),
  },
  {
    key: 'accession',
    label: 'Accession No.',
    sortKey: 'accession',
    cell: (r) => <span className="font-mono text-xs">{r.accession}</span>,
  },
  {
    key: 'title',
    label: 'Book Title',
    sortKey: 'title',
    cell: (r) => r.title,
    className: 'min-w-[200px]',
  },
  { key: 'author', label: 'Author', cell: (r) => r.author || '—' },
  {
    key: 'department',
    label: 'Department',
    sortKey: 'department',
    cell: (r) => r.department || '—',
  },
  {
    key: 'borrowerName',
    label: 'Borrower',
    sortKey: 'borrower',
    cell: (r) => r.borrowerName || '—',
    className: 'min-w-[140px]',
  },
  { key: 'borrowerCode', label: 'Roll No. / Staff ID', cell: (r) => r.borrowerCode || '—' },
  { key: 'memberType', label: 'Member Type', cell: (r) => r.memberTypeLabel },
  {
    key: 'issuedAt',
    label: 'Original Issue Date',
    cell: (r) => fmtDate(r.issuedAt),
    className: 'whitespace-nowrap',
  },
  {
    key: 'currentDueAt',
    label: 'Current Due Date',
    cell: (r) => fmtDate(r.currentDueAt),
    className: 'whitespace-nowrap',
  },
  {
    key: 'previousDueAt',
    label: 'Previous Due Date',
    cell: (r) => (r.type === 'RENEW' ? fmtDate(r.previousDueAt) : '—'),
    className: 'whitespace-nowrap',
  },
  {
    key: 'newDueAt',
    label: 'New Due Date',
    cell: (r) => (r.type === 'RENEW' ? fmtDate(r.dueAt) : '—'),
    className: 'whitespace-nowrap',
  },
  { key: 'renewalCount', label: 'Renewal Count', cell: (r) => r.renewalCount },
  {
    key: 'returnedAt',
    label: 'Actual Return Date',
    cell: (r) => (r.type === 'RETURN' ? fmtDateTime(r.returnedAt) : '—'),
    className: 'whitespace-nowrap',
  },
  {
    key: 'returnedBy',
    label: 'Returned By',
    cell: (r) =>
      r.type === 'RETURN' ? (
        r.returnedByType ? (
          <span>
            {r.returnedByName || '—'}
            {r.returnedByCode ? (
              <span className="block text-xs text-slate-500">{r.returnedByCode}</span>
            ) : null}
            {r.returnedByType !== 'BORROWER' ? (
              <span className="block text-xs text-amber-700">{r.returnedByTypeLabel}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Not recorded</span>
        )
      ) : (
        '—'
      ),
    className: 'min-w-[130px]',
  },
  {
    key: 'processedBy',
    label: 'Received / Processed By',
    sortKey: 'processedBy',
    cell: (r) => r.processedBy || '—',
  },
  {
    key: 'bookCondition',
    label: 'Condition',
    cell: (r) =>
      r.type === 'RETURN'
        ? r.bookCondition
          ? r.bookCondition.charAt(0) + r.bookCondition.slice(1).toLowerCase()
          : 'Not recorded'
        : '—',
  },
  {
    key: 'daysLate',
    label: 'Days Late',
    cell: (r) => (r.type === 'RETURN' && r.isLate ? (r.daysLate ?? '—') : '—'),
  },
  { key: 'fineAmount', label: 'Fine', sortKey: 'fine', cell: (r) => money(r.fineAmount) },
  {
    key: 'fineStatus',
    label: 'Fine Status',
    cell: (r) => (r.fineStatus === 'NONE' ? '—' : r.fineStatusLabel),
  },
  {
    key: 'status',
    label: 'Status',
    cell: (r) => <Pill tone={STATUS_TONE[r.status]}>{r.statusLabel}</Pill>,
  },
  { key: 'remarks', label: 'Remarks', cell: (r) => r.remarks || '—' },
];

const LOAN_COLUMNS: Column<CirculationLoanRow>[] = [
  {
    key: 'receiptNo',
    label: 'Receipt',
    cell: (r) => <span className="font-mono text-xs">{r.receiptNo || '—'}</span>,
  },
  {
    key: 'accession',
    label: 'Accession No.',
    cell: (r) => <span className="font-mono text-xs">{r.accession}</span>,
  },
  {
    key: 'title',
    label: 'Book Title',
    sortKey: 'title',
    cell: (r) => r.title,
    className: 'min-w-[200px]',
  },
  { key: 'author', label: 'Author', cell: (r) => r.author || '—' },
  {
    key: 'borrowerName',
    label: 'Borrower',
    cell: (r) => r.borrowerName || '—',
    className: 'min-w-[140px]',
  },
  { key: 'borrowerCode', label: 'Roll No. / Staff ID', cell: (r) => r.borrowerCode || '—' },
  { key: 'memberType', label: 'Member Type', cell: (r) => r.memberTypeLabel },
  { key: 'department', label: 'Department', cell: (r) => r.department || '—' },
  { key: 'mobile', label: 'Contact', cell: (r) => r.mobile || '—' },
  {
    key: 'issuedAt',
    label: 'Issue Date',
    sortKey: 'issuedAt',
    cell: (r) => fmtDate(r.issuedAt),
    className: 'whitespace-nowrap',
  },
  {
    key: 'dueAt',
    label: 'Due Date',
    sortKey: 'dueAt',
    cell: (r) => fmtDate(r.dueAt),
    className: 'whitespace-nowrap',
  },
  { key: 'renewalCount', label: 'Renewals', cell: (r) => r.renewalCount },
  {
    key: 'overdueDays',
    label: 'Days Overdue',
    cell: (r) =>
      r.overdueDays ? <span className="font-medium text-rose-700">{r.overdueDays}</span> : '—',
  },
  { key: 'outstandingFine', label: 'Outstanding Fine', cell: (r) => money(r.outstandingFine) },
  { key: 'issuedBy', label: 'Issued By', cell: (r) => r.issuedBy || '—' },
  {
    key: 'status',
    label: 'Status',
    cell: (r) => <Pill tone={STATUS_TONE[r.status]}>{r.statusLabel}</Pill>,
  },
];

const INCIDENT_COLUMNS: Column<CirculationIncidentRow>[] = [
  {
    key: 'occurredAt',
    label: 'Date',
    cell: (r) => fmtDateTime(r.occurredAt),
    className: 'whitespace-nowrap',
  },
  {
    key: 'type',
    label: 'Type',
    cell: (r) => (
      <Pill tone={r.incidentType === 'LOST' ? STATUS_TONE.LOST : STATUS_TONE.RETURNED_DAMAGED}>
        {r.typeLabel}
      </Pill>
    ),
  },
  {
    key: 'accession',
    label: 'Accession No.',
    cell: (r) => <span className="font-mono text-xs">{r.accession}</span>,
  },
  { key: 'title', label: 'Book Title', cell: (r) => r.title, className: 'min-w-[200px]' },
  { key: 'borrowerName', label: 'Borrower', cell: (r) => r.borrowerName || '—' },
  { key: 'borrowerCode', label: 'Roll No. / Staff ID', cell: (r) => r.borrowerCode || '—' },
  { key: 'department', label: 'Department', cell: (r) => r.department || '—' },
  { key: 'chargeAmount', label: 'Charge', cell: (r) => money(r.chargeAmount) },
  {
    key: 'fineStatus',
    label: 'Fine Status',
    cell: (r) => (r.fineStatus === 'NONE' ? '—' : r.fineStatusLabel),
  },
  { key: 'remarks', label: 'Remarks', cell: (r) => r.remarks || '—' },
  {
    key: 'recovery',
    label: 'Recovery Status',
    cell: (r) => (
      <Pill
        tone={
          r.recoveryStatus === 'OPEN'
            ? 'bg-amber-50 text-amber-800'
            : 'bg-emerald-50 text-emerald-700'
        }
      >
        {r.recoveryStatusLabel}
      </Pill>
    ),
  },
  { key: 'reportedBy', label: 'Recorded By', cell: (r) => r.reportedBy || '—' },
];

const DEFAULT_HIDDEN: Partial<Record<CirculationReportKey, string[]>> = {
  all: ['author', 'memberType', 'previousDueAt', 'newDueAt', 'daysLate', 'fineStatus', 'remarks'],
  issued: [
    'author',
    'previousDueAt',
    'newDueAt',
    'returnedAt',
    'returnedBy',
    'bookCondition',
    'daysLate',
    'fineAmount',
    'fineStatus',
    'remarks',
  ],
  renewed: [
    'author',
    'returnedAt',
    'returnedBy',
    'bookCondition',
    'daysLate',
    'fineAmount',
    'fineStatus',
    'remarks',
  ],
  returned: ['author', 'memberType', 'previousDueAt', 'newDueAt', 'remarks'],
  late: ['author', 'memberType', 'previousDueAt', 'newDueAt', 'bookCondition'],
  borrower: [
    'department',
    'borrowerName',
    'borrowerCode',
    'memberType',
    'author',
    'previousDueAt',
    'newDueAt',
    'remarks',
  ],
  current: ['receiptNo', 'author', 'mobile'],
  overdue: ['receiptNo', 'author', 'issuedBy'],
  'lost-damaged': [],
};

function useColumnVisibility(report: CirculationReportKey, keys: string[]) {
  const storageKey = `library-circulation-columns:${report}`;
  const [hidden, setHidden] = useState<string[]>(DEFAULT_HIDDEN[report] ?? []);
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    setHidden(saved ? (JSON.parse(saved) as string[]) : (DEFAULT_HIDDEN[report] ?? []));
  }, [storageKey, report]);
  const toggle = (key: string) => {
    setHidden((current) => {
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };
  const reset = () => {
    window.localStorage.removeItem(storageKey);
    setHidden(DEFAULT_HIDDEN[report] ?? []);
  };
  return { visible: keys.filter((k) => !hidden.includes(k)), hidden, toggle, reset };
}

function ColumnPicker({
  columns,
  hidden,
  onToggle,
  onReset,
}: {
  columns: { key: string; label: string }[];
  hidden: string[];
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="mr-1 h-4 w-4" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {columns.map((c) => (
          <DropdownMenuItem
            key={c.key}
            onSelect={(event) => {
              event.preventDefault();
              onToggle(c.key);
            }}
          >
            <Check
              className={cn('mr-2 h-4 w-4', hidden.includes(c.key) ? 'opacity-0' : 'opacity-100')}
            />
            {c.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onReset}>Reset to default</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortableTable<T extends { id: string }>({
  columns,
  rows,
  visible,
  sortBy,
  sortDir,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  visible: string[];
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const shown = columns.filter((c) => visible.includes(c.key));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500">
            {shown.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2.5">
                {c.sortKey ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-slate-800"
                    onClick={() => onSort(c.sortKey!)}
                  >
                    {c.label}
                    {sortBy === c.sortKey ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : null}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={shown.length} className="px-4 py-10 text-center text-slate-500">
                No records for the selected period and filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                {shown.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupTable<T>({
  headers,
  rows,
  render,
  onRowClick,
  rowKey,
}: {
  headers: string[];
  rows: T[];
  render: (row: T) => ReactNode[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500">
            {headers.map((h, i) => (
              <th key={h} className={cn('px-3 py-2.5', i > 0 && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-slate-500">
                No circulation in the selected period.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'border-b border-slate-100',
                  onRowClick && 'cursor-pointer hover:bg-sky-50/60',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {render(row).map((cell, i) => (
                  <td key={i} className={cn('px-3 py-2', i > 0 && 'text-right tabular-nums')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CirculationReportTable({
  report,
  data,
  sortBy,
  sortDir,
  onSort,
  onDepartment,
  onLibrarian,
}: {
  report: CirculationReportKey;
  data: CirculationRowsResponse;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort: (key: string) => void;
  onDepartment: (row: CirculationDepartmentRow) => void;
  onLibrarian: (row: CirculationLibrarianRow) => void;
}) {
  const columns = useMemo(() => {
    if (data.kind === 'loans') return LOAN_COLUMNS.map(({ key, label }) => ({ key, label }));
    if (data.kind === 'incidents')
      return INCIDENT_COLUMNS.map(({ key, label }) => ({ key, label }));
    if (data.kind === 'transactions') return TXN_COLUMNS.map(({ key, label }) => ({ key, label }));
    return [];
  }, [data.kind]);
  const { visible, hidden, toggle, reset } = useColumnVisibility(
    report,
    columns.map((c) => c.key),
  );

  if (data.kind === 'departments') {
    return (
      <GroupTable
        headers={[
          'Department',
          'Issues',
          'Renewals',
          'Returns',
          'Late Returns',
          'Currently Borrowed',
          'Overdue',
          'Borrowers',
        ]}
        rows={data.items}
        rowKey={(r) => r.departmentId ?? 'none'}
        onRowClick={onDepartment}
        render={(r) => [
          r.department,
          r.issues,
          r.renewals,
          r.returns,
          r.lateReturns,
          r.currentlyBorrowed,
          r.overdue,
          r.borrowers,
        ]}
      />
    );
  }
  if (data.kind === 'librarians') {
    return (
      <GroupTable
        headers={['Librarian / Staff', 'Issues', 'Renewals', 'Returns', 'Total', 'Last Activity']}
        rows={data.items}
        rowKey={(r) => r.processedById ?? 'none'}
        onRowClick={onLibrarian}
        render={(r) => [
          r.name,
          r.issues,
          r.renewals,
          r.returns,
          r.total,
          fmtDateTime(r.lastActivityAt),
        ]}
      />
    );
  }

  const picker = (
    <div className="flex justify-end border-b border-slate-100 px-3 py-2">
      <ColumnPicker columns={columns} hidden={hidden} onToggle={toggle} onReset={reset} />
    </div>
  );
  if (data.kind === 'loans') {
    return (
      <>
        {picker}
        <SortableTable
          columns={LOAN_COLUMNS}
          rows={data.items}
          visible={visible}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
      </>
    );
  }
  if (data.kind === 'incidents') {
    return (
      <>
        {picker}
        <SortableTable
          columns={INCIDENT_COLUMNS}
          rows={data.items}
          visible={visible}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
      </>
    );
  }
  return (
    <>
      {picker}
      <SortableTable
        columns={TXN_COLUMNS}
        rows={data.items}
        visible={visible}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={onSort}
      />
    </>
  );
}
