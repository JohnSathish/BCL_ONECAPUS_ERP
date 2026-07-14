'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { api } from '@/services/api';
import { apiErrorMessage } from '@/utils/api-error';

export type EnterpriseField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'date' | 'email';
  required?: boolean;
};

export type EnterpriseColumn = {
  key: string;
  label: string;
};

function unwrapList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['items', 'data', 'rows', 'results', 'tickets', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function cellValue(row: Record<string, unknown>, key: string): string {
  const parts = key.split('.');
  let cur: unknown = row;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return '—';
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur == null || cur === '') return '—';
  if (typeof cur === 'object') return JSON.stringify(cur);
  return String(cur);
}

type Props = {
  title: string;
  description: string;
  queryKey: string[];
  listPath: string;
  createPath?: string;
  fields: EnterpriseField[];
  columns: EnterpriseColumn[];
  emptyLabel?: string;
};

export function EnterpriseCrudWorkspace({
  title,
  description,
  queryKey,
  listPath,
  createPath,
  fields,
  columns,
  emptyLabel = 'No records yet.',
}: Props) {
  const authEnabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const initialForm = useMemo(() => Object.fromEntries(fields.map((f) => [f.name, ''])), [fields]);
  const [form, setForm] = useState<Record<string, string>>(initialForm);

  const listQ = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(listPath);
      return unwrapList(data);
    },
    enabled: authEnabled,
    retry: 1,
  });

  const createMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post(createPath ?? listPath, payload);
      return data;
    },
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Record created.' });
      setForm(initialForm);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Create failed') }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = form[field.name]?.trim() ?? '';
      if (!raw) {
        if (field.required) {
          setMessage({ tone: 'err', text: `${field.label} is required.` });
          return;
        }
        continue;
      }
      payload[field.name] = field.type === 'number' ? Number(raw) : raw;
    }
    createMut.mutate(payload);
  };

  const rows = listQ.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {message ? (
        <p
          className={
            message.tone === 'ok' ? 'text-sm text-emerald-700' : 'text-sm text-destructive'
          }
        >
          {message.text}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create</CardTitle>
          <CardDescription>Minimal create form for this module</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <label key={field.name} className="space-y-1 text-sm">
                <span className="text-muted-foreground">
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <Input
                  type={field.type ?? 'text'}
                  placeholder={field.placeholder}
                  value={form[field.name] ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                />
              </label>
            ))}
            <div className="flex items-end">
              <Button type="submit" disabled={createMut.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {createMut.isPending ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Records</CardTitle>
          <CardDescription>
            {listQ.isLoading ? 'Loading…' : `${rows.length} record(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isError ? (
            <p className="text-sm text-muted-foreground">
              Unable to load records ({apiErrorMessage(listQ.error)}). The API may not be deployed
              yet.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {columns.map((col) => (
                      <th key={col.key} className="pb-2 pr-4 font-medium">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={String(row.id ?? row.ticketNo ?? row.code ?? idx)}
                      className="border-b border-border/50"
                    >
                      {columns.map((col) => (
                        <td key={col.key} className="py-2 pr-4">
                          {cellValue(row, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
