'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createCommunicationTemplate,
  deleteCommunicationTemplate,
  fetchCommunicationTemplates,
  seedCommunicationTemplates,
  updateCommunicationTemplate,
} from '@/services/communication';

export function TemplatesManager() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'GENERAL',
    subject: '',
    bodyText: '',
    channels: ['EMAIL', 'IN_APP'] as string[],
  });

  const templates = useQuery({
    queryKey: ['communication', 'templates'],
    queryFn: () => fetchCommunicationTemplates(),
    enabled,
  });

  const seed = useMutation({
    mutationFn: seedCommunicationTemplates,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication'] }),
  });

  const save = useMutation({
    mutationFn: () =>
      editing ? updateCommunicationTemplate(editing, form) : createCommunicationTemplate(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      setEditing(null);
      setForm({
        code: '',
        name: '',
        category: 'GENERAL',
        subject: '',
        bodyText: '',
        channels: ['EMAIL', 'IN_APP'],
      });
    },
  });

  const remove = useMutation({
    mutationFn: deleteCommunicationTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
          <Sparkles className="mr-2 h-4 w-4" />
          Load defaults
        </Button>
        <Button variant="outline" onClick={() => setEditing('new')}>
          New template
        </Button>
      </div>

      {editing ? (
        <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              disabled={editing !== 'new'}
            />
            <Input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <Input
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
          <textarea
            className="min-h-[120px] w-full rounded-xl border border-border/80 px-3 py-2 text-sm"
            placeholder="Body"
            value={form.bodyText}
            onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {(templates.data ?? []).map((t) => (
          <div key={t.id} className="rounded-2xl border border-border/80 bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.code} · {t.category}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {t.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.subject}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(t.id);
                  setForm({
                    code: t.code,
                    name: t.name,
                    category: t.category,
                    subject: t.subject ?? '',
                    bodyText: t.bodyText ?? '',
                    channels: t.channels,
                  });
                }}
              >
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(t.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
