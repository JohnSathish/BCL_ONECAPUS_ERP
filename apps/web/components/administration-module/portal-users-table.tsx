'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import {
  Eye,
  KeyRound,
  LogIn,
  Mail,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import type { PortalUserRow } from '@/types/administration';
import { AdminGlassCard } from './ui/admin-shell';
import { AdminStatusPill } from './ui/admin-status-pill';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/format-date';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type Props = {
  rows: PortalUserRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onView: (row: PortalUserRow) => void;
  onEdit: (row: PortalUserRow) => void;
  onActivate: (row: PortalUserRow) => void;
  onSuspend: (row: PortalUserRow) => void;
  onResetPassword: (row: PortalUserRow) => void;
  onSendCredentials: (row: PortalUserRow) => void;
  onImpersonate: (row: PortalUserRow) => void;
  canManage: boolean;
  canImpersonate: boolean;
};

export function PortalUsersTable({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  onView,
  onEdit,
  onActivate,
  onSuspend,
  onResetPassword,
  onSendCredentials,
  onImpersonate,
  canManage,
  canImpersonate,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  return (
    <AdminGlassCard className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Department</th>
              <th className="px-3 py-3">Shift</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Last login</th>
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
        </table>
        <div ref={parentRef} className="max-h-[520px] overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const row = rows[vRow.index];
              if (!row) return null;
              return (
                <div
                  key={row.id}
                  className={cn(
                    'absolute left-0 flex w-full min-w-[960px] items-center border-b border-border/50 text-sm hover:bg-muted/30',
                    selectedIds.has(row.id) && 'bg-primary/5',
                  )}
                  style={{
                    height: `${vRow.size}px`,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                >
                  <div className="w-10 shrink-0 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => onToggle(row.id)}
                    />
                  </div>
                  <div className="min-w-[200px] flex-1 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-violet-600 text-xs font-semibold text-white">
                        {row.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-32 shrink-0 px-3 text-xs">{row.roles[0]?.name ?? '—'}</div>
                  <div className="w-36 shrink-0 px-3 text-xs truncate">
                    {row.department?.name ?? '—'}
                  </div>
                  <div className="w-28 shrink-0 px-3 text-xs truncate">
                    {row.shift?.name ?? '—'}
                  </div>
                  <div className="w-28 shrink-0 px-3">
                    <AdminStatusPill status={row.accountStatus} />
                  </div>
                  <div className="w-36 shrink-0 px-3 text-xs text-muted-foreground">
                    {row.lastLoginAt ? formatDisplayDateTime(row.lastLoginAt) : 'Never'}
                  </div>
                  <div className="w-12 shrink-0 px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(row)}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        {canManage ? (
                          <>
                            <DropdownMenuItem onClick={() => onEdit(row)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {row.accountStatus !== 'active' ? (
                              <DropdownMenuItem onClick={() => onActivate(row)}>
                                <ShieldCheck className="mr-2 h-4 w-4" /> Activate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => onSuspend(row)}>
                                <ShieldOff className="mr-2 h-4 w-4" /> Suspend
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onResetPassword(row)}>
                              <KeyRound className="mr-2 h-4 w-4" /> Reset password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSendCredentials(row)}>
                              <Mail className="mr-2 h-4 w-4" /> Send credentials
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {canImpersonate ? (
                          <DropdownMenuItem onClick={() => onImpersonate(row)}>
                            <LogIn className="mr-2 h-4 w-4" /> Login as user
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminGlassCard>
  );
}
