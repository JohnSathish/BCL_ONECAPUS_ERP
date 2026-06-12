'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { GlassCard } from '@/components/erp/glass-card';
import { fetchAuditLogs } from '@/services/accommodation';
import { inputClass, StatusBadge } from '@/components/hr-module/accommodation/accommodation-utils';

const ACTION_LABELS: Record<string, string> = {
  QUARTER_CREATED: 'Quarter created',
  QUARTER_EDITED: 'Quarter edited',
  QUARTER_ARCHIVED: 'Quarter archived',
  QUARTER_STATUS_CHANGED: 'Status changed',
  QUARTER_ALLOCATED: 'Quarter allocated',
  QUARTER_VACATED: 'Quarter vacated',
  CHARGE_ADDED: 'Charge added',
  CHARGE_REMOVED: 'Charge removed',
};

export function AccommodationAuditPanel({ enabled }: { enabled: boolean }) {
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const auditQ = useQuery({
    queryKey: ['accommodation', 'audit', entityType],
    queryFn: () => fetchAuditLogs(entityType ? { entityType } : undefined),
    enabled,
  });

  const rows = (auditQ.data ?? []).filter((log: { action: string; entityType: string }) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return log.action.toLowerCase().includes(term) || log.entityType.toLowerCase().includes(term);
  });

  return (
    <GlassCard className="overflow-auto p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Audit Log</h3>
        <div className="flex flex-wrap gap-2">
          <select
            className={inputClass('w-auto min-w-[120px]')}
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">All entities</option>
            <option value="QUARTER">Quarter</option>
            <option value="OCCUPANCY">Occupancy</option>
            <option value="CHARGE">Charge</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              className={inputClass('w-44 pl-7')}
              placeholder="Filter actions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
            <th className="py-2 pr-2">When</th>
            <th className="py-2 pr-2">Action</th>
            <th className="py-2 pr-2">Entity</th>
            <th className="py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(
            (log: {
              id: string;
              createdAt: string;
              action: string;
              entityType: string;
              entityId: string;
              oldValue?: unknown;
              newValue?: unknown;
            }) => (
              <tr key={log.id} className="border-b border-border/40 align-top">
                <td className="py-2 pr-2 whitespace-nowrap text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString('en-IN')}
                </td>
                <td className="py-2 pr-2">
                  <span className="font-medium">
                    {ACTION_LABELS[log.action] ?? log.action.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <StatusBadge status={log.entityType} />
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    className="text-left text-[10px] text-primary hover:underline"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    {expandedId === log.id ? 'Hide' : 'View'} change
                  </button>
                  {expandedId === log.id ? (
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
                      {JSON.stringify({ old: log.oldValue, new: log.newValue }, null, 2)}
                    </pre>
                  ) : null}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {!rows.length && !auditQ.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No audit entries match your filters.
        </p>
      ) : null}
    </GlassCard>
  );
}
