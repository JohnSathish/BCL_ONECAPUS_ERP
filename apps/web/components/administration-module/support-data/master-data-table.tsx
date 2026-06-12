'use client';

import { AdminStatusPill } from '@/components/administration-module/ui/admin-status-pill';
import { Button } from '@/components/ui/button';
import type { SupportDataFieldDef, SupportDataRow } from '@/types/support-data';

type Props = {
  rows: SupportDataRow[];
  fields: SupportDataFieldDef[];
  canEdit: boolean;
  onEdit: (row: SupportDataRow) => void;
  onToggleStatus: (row: SupportDataRow) => void;
  onMoveUp?: (row: SupportDataRow) => void;
  onMoveDown?: (row: SupportDataRow) => void;
  reorderEnabled?: boolean;
};

export function MasterDataTable({
  rows,
  fields,
  canEdit,
  onEdit,
  onToggleStatus,
  onMoveUp,
  onMoveDown,
  reorderEnabled,
}: Props) {
  const extraFields = fields.filter(
    (f) => !['code', 'label', 'subjectCode', 'subjectName', 'sortOrder', 'status'].includes(f.key),
  );
  const codeLabel = fields.some((field) => field.key === 'subjectCode') ? 'Subject Code' : 'Code';
  const labelLabel = fields.some((field) => field.key === 'subjectName') ? 'Subject Name' : 'Label';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-3">{codeLabel}</th>
            <th className="px-4 py-3">{labelLabel}</th>
            {extraFields.map((f) => (
              <th key={f.key} className="px-4 py-3">
                {f.label}
              </th>
            ))}
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Status</th>
            {canEdit ? <th className="px-4 py-3">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={6 + extraFields.length}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No entries found
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
                <td className="px-4 py-2">{row.label}</td>
                {extraFields.map((f) => (
                  <td key={f.key} className="px-4 py-2 text-muted-foreground">
                    {String(row.metadata?.[f.key] ?? '—')}
                  </td>
                ))}
                <td className="px-4 py-2">{row.sortOrder}</td>
                <td className="px-4 py-2">
                  <AdminStatusPill status={row.isActive ? 'active' : 'inactive'} />
                </td>
                {canEdit ? (
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(row)}
                      >
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      {reorderEnabled && onMoveUp ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onMoveUp(row)}
                        >
                          ↑
                        </Button>
                      ) : null}
                      {reorderEnabled && onMoveDown ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onMoveDown(row)}
                        >
                          ↓
                        </Button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
