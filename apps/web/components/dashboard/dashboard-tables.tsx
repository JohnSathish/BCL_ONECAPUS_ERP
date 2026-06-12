'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DASHBOARD_PENDING_APPROVALS,
  DASHBOARD_RECENT_ADMISSIONS,
  DASHBOARD_FEE_DUES,
} from '@/modules/dashboard/mock-data';
import { cn } from '@/utils/cn';

type TableId = 'admissions' | 'approvals' | 'fees';

const TABLES: { id: TableId; title: string; description: string }[] = [
  { id: 'admissions', title: 'Recent admissions', description: 'Latest application activity' },
  { id: 'approvals', title: 'Pending approvals', description: 'Items requiring action' },
  { id: 'fees', title: 'Fee dues', description: 'Outstanding installments' },
];

export function DashboardTables() {
  const [active, setActive] = useState<TableId>('admissions');
  const [query, setQuery] = useState('');

  const rows =
    active === 'admissions'
      ? DASHBOARD_RECENT_ADMISSIONS
      : active === 'approvals'
        ? DASHBOARD_PENDING_APPROVALS
        : DASHBOARD_FEE_DUES;

  const filtered = rows.filter((row) =>
    Object.values(row).some((v) => String(v).toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card w-full rounded-2xl p-5 lg:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Operations desk</h3>
          <p className="text-sm text-muted-foreground">Full-width actionable records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABLES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition',
                active === t.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted',
              )}
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search table…"
          className="h-10 pl-9"
        />
      </div>

      <div className="mt-4 w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-border">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr className="border-b border-border">
              {active === 'admissions' ? (
                <>
                  <Th>Application</Th>
                  <Th>Applicant</Th>
                  <Th>Program</Th>
                  <Th>Score</Th>
                  <Th>Status</Th>
                </>
              ) : active === 'approvals' ? (
                <>
                  <Th>Request</Th>
                  <Th>Owner</Th>
                  <Th>Module</Th>
                  <Th>Due</Th>
                  <Th>Priority</Th>
                </>
              ) : (
                <>
                  <Th>Student</Th>
                  <Th>Program</Th>
                  <Th>Amount</Th>
                  <Th>Due date</Th>
                  <Th>Status</Th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-b border-border/60 transition hover:bg-muted/40">
                {active === 'admissions' && 'application' in row ? (
                  <>
                    <Td className="font-mono text-xs">{row.application}</Td>
                    <Td>{row.applicant}</Td>
                    <Td>{row.program}</Td>
                    <Td>{row.score}</Td>
                    <Td>
                      <Badge tone={row.status}>{row.status}</Badge>
                    </Td>
                  </>
                ) : null}
                {active === 'approvals' && 'request' in row ? (
                  <>
                    <Td className="font-medium">{row.request}</Td>
                    <Td>{row.owner}</Td>
                    <Td>{row.module}</Td>
                    <Td>{row.due}</Td>
                    <Td>
                      <Badge tone={row.priority}>{row.priority}</Badge>
                    </Td>
                  </>
                ) : null}
                {active === 'fees' && 'student' in row ? (
                  <>
                    <Td className="font-medium">{row.student}</Td>
                    <Td>{row.program}</Td>
                    <Td>{row.amount}</Td>
                    <Td>{row.dueDate}</Td>
                    <Td>
                      <Badge tone={row.status}>{row.status}</Badge>
                    </Td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} records · Page 1 of 1
      </p>
    </motion.section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3', className)}>{children}</td>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  const styles: Record<string, string> = {
    shortlisted: 'bg-primary/10 text-primary',
    submitted: 'bg-muted text-muted-foreground',
    high: 'bg-danger/10 text-danger',
    medium: 'bg-warning/10 text-warning',
    overdue: 'bg-danger/10 text-danger',
    due: 'bg-warning/10 text-warning',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase',
        styles[tone.toLowerCase()] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}
