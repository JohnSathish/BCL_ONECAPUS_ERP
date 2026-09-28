'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { erpSelectClass } from '@/components/erp/form-primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  createQuestionBankMaster,
  deleteQuestionBankMaster,
  fetchQuestionBankMasters,
  updateQuestionBankMaster,
} from '@/services/website-cms';
import type { QuestionBankMaster, QuestionBankMasterKind } from '@/types/website-cms';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { QB_MASTER_KINDS } from './question-bank-shared';

type Draft = { label: string; code: string; parentId: string; sortOrder: string };
const emptyDraft: Draft = { label: '', code: '', parentId: '', sortOrder: '0' };

export function QuestionBankMastersPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<QuestionBankMasterKind>('ACADEMIC_YEAR');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);

  const meta = QB_MASTER_KINDS.find((item) => item.kind === kind)!;
  const rows = useQuery({
    queryKey: ['website', 'question-bank', 'masters', kind],
    queryFn: () => fetchQuestionBankMasters(kind),
  });
  const departments = useQuery({
    queryKey: ['website', 'question-bank', 'masters', 'DEPARTMENT'],
    queryFn: () => fetchQuestionBankMasters('DEPARTMENT'),
    enabled: kind === 'SUBJECT',
  });
  const departmentName = (id: string | null) =>
    departments.data?.find((row) => row.id === id)?.label ?? '—';

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['website', 'question-bank'] });

  const payloadFrom = (value: Draft) => ({
    label: value.label.trim(),
    code: value.code.trim(),
    parentId: kind === 'SUBJECT' ? value.parentId || null : undefined,
    sortOrder: Number.parseInt(value.sortOrder, 10) || 0,
  });

  const create = useMutation({
    mutationFn: () => createQuestionBankMaster({ kind, ...payloadFrom(draft) }),
    onSuccess: (row) => {
      onMessage(`Added ${meta.singular} “${row.label}”.`);
      setDraft(emptyDraft);
      void invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, `Could not add ${meta.singular}`)),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateQuestionBankMaster>[1];
    }) => updateQuestionBankMaster(id, payload),
    onSuccess: () => {
      setEditingId(null);
      void invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not update record')),
  });

  const remove = useMutation({
    mutationFn: deleteQuestionBankMaster,
    onSuccess: () => {
      onMessage(`${meta.singular[0].toUpperCase()}${meta.singular.slice(1)} deleted.`);
      void invalidate();
    },
    onError: (error) => onMessage(apiErrorMessage(error, 'Could not delete record')),
  });

  const startEdit = (row: QuestionBankMaster) => {
    setEditingId(row.id);
    setEditDraft({
      label: row.label,
      code: row.code ?? '',
      parentId: row.parentId ?? '',
      sortOrder: String(row.sortOrder),
    });
  };

  const showCode = Boolean(meta.codeLabel);
  const showParent = kind === 'SUBJECT';

  const departmentSelect = (value: string, onChange: (value: string) => void, id: string) => (
    <select
      id={id}
      className={erpSelectClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Department"
    >
      <option value="">No department</option>
      {(departments.data ?? []).map((dept) => (
        <option key={dept.id} value={dept.id}>
          {dept.label}
        </option>
      ))}
    </select>
  );

  return (
    <CompactCard>
      <CompactCardHeader
        title="Master data"
        description="Maintain reusable values so question papers are tagged consistently. Deactivate values instead of deleting them once papers use them."
      />
      <CompactCardBody className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Master data type">
          {QB_MASTER_KINDS.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="tab"
              aria-selected={kind === item.kind}
              onClick={() => {
                setKind(item.kind);
                setEditingId(null);
                setDraft(emptyDraft);
              }}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                kind === item.kind
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          className="grid gap-2 rounded-lg border border-dashed border-border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)_90px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.label.trim()) {
              onMessage(`Enter a ${meta.singular} name.`);
              return;
            }
            create.mutate();
          }}
        >
          <Input
            aria-label={`New ${meta.singular}`}
            placeholder={meta.placeholder}
            value={draft.label}
            maxLength={160}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            className="h-9 text-sm"
          />
          {showCode ? (
            <Input
              aria-label={meta.codeLabel}
              placeholder={meta.codeLabel}
              value={draft.code}
              maxLength={40}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
              className="h-9 text-sm"
            />
          ) : (
            <span className="hidden md:block" />
          )}
          {showParent ? (
            departmentSelect(
              draft.parentId,
              (parentId) => setDraft({ ...draft, parentId }),
              'qb-new-parent',
            )
          ) : (
            <span className="hidden md:block" />
          )}
          <Input
            aria-label="Sort order"
            type="number"
            min={0}
            value={draft.sortOrder}
            onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
            className="h-9 text-sm"
          />
          <Button type="submit" size="sm" className="h-9" disabled={create.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </form>

        {rows.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !rows.data?.length ? (
          <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
            No {meta.label.toLowerCase()} yet. Add the first one above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  {showCode ? <th className="px-3 py-2 font-semibold">{meta.codeLabel}</th> : null}
                  {showParent ? <th className="px-3 py-2 font-semibold">Department</th> : null}
                  <th className="px-3 py-2 font-semibold">Order</th>
                  <th className="px-3 py-2 font-semibold">Used by</th>
                  <th className="px-3 py-2 font-semibold">Active</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.data.map((row) => {
                  const editing = editingId === row.id;
                  return (
                    <tr key={row.id} className="border-t border-border/60 align-middle">
                      <td className="px-3 py-2">
                        {editing ? (
                          <Input
                            aria-label="Name"
                            value={editDraft.label}
                            maxLength={160}
                            onChange={(event) =>
                              setEditDraft({ ...editDraft, label: event.target.value })
                            }
                            className="h-8 text-sm"
                          />
                        ) : (
                          <span
                            className={cn(!row.isActive && 'text-muted-foreground line-through')}
                          >
                            {row.label}
                          </span>
                        )}
                      </td>
                      {showCode ? (
                        <td className="px-3 py-2 font-mono text-xs">
                          {editing ? (
                            <Input
                              aria-label={meta.codeLabel}
                              value={editDraft.code}
                              maxLength={40}
                              onChange={(event) =>
                                setEditDraft({ ...editDraft, code: event.target.value })
                              }
                              className="h-8 text-sm"
                            />
                          ) : (
                            row.code || '—'
                          )}
                        </td>
                      ) : null}
                      {showParent ? (
                        <td className="px-3 py-2">
                          {editing
                            ? departmentSelect(
                                editDraft.parentId,
                                (parentId) => setEditDraft({ ...editDraft, parentId }),
                                `qb-edit-parent-${row.id}`,
                              )
                            : departmentName(row.parentId)}
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        {editing ? (
                          <Input
                            aria-label="Sort order"
                            type="number"
                            min={0}
                            value={editDraft.sortOrder}
                            onChange={(event) =>
                              setEditDraft({ ...editDraft, sortOrder: event.target.value })
                            }
                            className="h-8 w-20 text-sm"
                          />
                        ) : (
                          row.sortOrder
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.usageCount} paper{row.usageCount === 1 ? '' : 's'}
                      </td>
                      <td className="px-3 py-2">
                        <Switch
                          checked={row.isActive}
                          aria-label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.label}`}
                          onCheckedChange={(isActive) =>
                            update.mutate({ id: row.id, payload: { isActive } })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          {editing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label="Save"
                                disabled={update.isPending}
                                onClick={() =>
                                  update.mutate({ id: row.id, payload: payloadFrom(editDraft) })
                                }
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label="Cancel"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label={`Edit ${row.label}`}
                                onClick={() => startEdit(row)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label={`Delete ${row.label}`}
                                disabled={remove.isPending}
                                onClick={() => {
                                  if (window.confirm(`Delete “${row.label}”?`))
                                    remove.mutate(row.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CompactCardBody>
    </CompactCard>
  );
}
