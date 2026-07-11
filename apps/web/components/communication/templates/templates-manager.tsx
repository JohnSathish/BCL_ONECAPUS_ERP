'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Monitor, RotateCcw, Send, Smartphone, Sparkles, Tablet, Trash2 } from 'lucide-react';

import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { VariablePicker } from '@/components/communication/compose/variable-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createCommunicationTemplate,
  deleteCommunicationTemplate,
  duplicateCommunicationTemplate,
  fetchCommunicationTemplates,
  previewCommunicationTemplate,
  restoreCommunicationTemplateDefault,
  seedCommunicationTemplates,
  testSendCommunicationTemplate,
  updateCommunicationTemplate,
} from '@/services/communication';
import type { CommunicationTemplate } from '@/types/communication';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';

const CATEGORY_FILTERS = [
  'ALL',
  'STUDENT',
  'STAFF',
  'PARENT',
  'ADMIN',
  'ADMISSIONS',
  'FEES',
  'EXAMINATIONS',
  'ACADEMICS',
  'LIBRARY',
  'HR',
  'GENERAL',
] as const;

type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTH: Record<Device, number> = {
  desktop: 640,
  tablet: 480,
  mobile: 360,
};

const emptyForm = {
  code: '',
  name: '',
  category: 'STUDENT',
  subject: '',
  bodyHtml: '',
  channels: ['EMAIL', 'IN_APP'] as string[],
};

export function TemplatesManager() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [category, setCategory] = useState<(typeof CATEGORY_FILTERS)[number]>('ALL');
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showHtmlSource, setShowHtmlSource] = useState(false);
  const [device, setDevice] = useState<Device>('desktop');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ['communication', 'templates'],
    queryFn: () => fetchCommunicationTemplates(),
    enabled,
  });

  const filtered = useMemo(() => {
    const rows = templates.data ?? [];
    if (category === 'ALL') return rows;
    return rows.filter((t) => t.category === category);
  }, [templates.data, category]);

  const seed = useMutation({
    mutationFn: seedCommunicationTemplates,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      setActionMsg('Default templates loaded (new codes only).');
    },
  });

  const save = useMutation({
    mutationFn: () =>
      editing && editing !== 'new'
        ? updateCommunicationTemplate(editing, {
            name: form.name,
            category: form.category,
            subject: form.subject,
            bodyHtml: form.bodyHtml,
            channels: form.channels,
          })
        : createCommunicationTemplate({
            code: form.code,
            name: form.name,
            category: form.category,
            subject: form.subject,
            bodyHtml: form.bodyHtml,
            channels: form.channels,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      setEditing(null);
      setForm(emptyForm);
      setActionMsg('Template saved.');
    },
    onError: (err) => setActionMsg(apiErrorMessage(err, 'Save failed')),
  });

  const remove = useMutation({
    mutationFn: deleteCommunicationTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      if (editing && editing !== 'new') {
        setEditing(null);
        setForm(emptyForm);
      }
    },
  });

  const duplicate = useMutation({
    mutationFn: duplicateCommunicationTemplate,
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      openEdit(row);
      setActionMsg('Template duplicated.');
    },
  });

  const restore = useMutation({
    mutationFn: restoreCommunicationTemplateDefault,
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['communication'] });
      openEdit(row);
      setActionMsg('Restored default content.');
    },
    onError: (err) => setActionMsg(apiErrorMessage(err, 'Restore failed')),
  });

  const testSend = useMutation({
    mutationFn: (id: string) => testSendCommunicationTemplate(id),
    onSuccess: (res) => setActionMsg(`Test email sent to ${res.to}`),
    onError: (err) => setActionMsg(apiErrorMessage(err, 'Test send failed')),
  });

  const previewMut = useMutation({
    mutationFn: () =>
      previewCommunicationTemplate({
        templateId: editing && editing !== 'new' ? editing : undefined,
        subject: form.subject,
        bodyHtml: form.bodyHtml,
        title: form.name,
      }),
    onSuccess: (res) => {
      setPreviewHtml(res.html);
      setPreviewSubject(res.subject);
    },
  });

  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(() => {
      previewMut.mutate();
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, form.subject, form.bodyHtml, form.name]);

  function openEdit(row: CommunicationTemplate) {
    setEditing(row.id);
    setForm({
      code: row.code,
      name: row.name,
      category: row.category || 'GENERAL',
      subject: row.subject ?? '',
      bodyHtml: row.bodyHtml ?? row.bodyText ?? '',
      channels: row.channels?.length ? row.channels : ['EMAIL', 'IN_APP'],
    });
    setShowHtmlSource(false);
    setActionMsg(null);
  }

  function openNew() {
    setEditing('new');
    setForm(emptyForm);
    setPreviewHtml('');
    setPreviewSubject('');
    setActionMsg(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={category === c ? 'default' : 'outline'}
              className="h-8"
              onClick={() => setCategory(c)}
            >
              {c === 'ALL' ? 'All' : c}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Sparkles className="mr-2 h-4 w-4" />
            Load defaults
          </Button>
          <Button variant="outline" onClick={openNew}>
            New template
          </Button>
        </div>
      </div>

      {actionMsg ? (
        <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm">
          {actionMsg}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="max-h-[70vh] space-y-1 overflow-auto rounded-2xl border border-border/80 bg-card p-2">
          {templates.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No templates in this category.</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openEdit(t)}
                className={cn(
                  'w-full rounded-xl px-3 py-2 text-left transition hover:bg-muted/60',
                  editing === t.id && 'bg-primary/10 ring-1 ring-primary/30',
                )}
              >
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {t.category} · {t.code}
                </p>
              </button>
            ))
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Code (e.g. STUDENT_WELCOME)"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  disabled={editing !== 'new'}
                />
                <Input
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Input
                  placeholder="Category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
                <Input
                  placeholder="Subject"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>

              <VariablePicker
                onInsert={(token) => setForm((f) => ({ ...f, bodyHtml: f.bodyHtml + token }))}
              />

              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Email body (HTML)</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowHtmlSource((v) => !v)}
                >
                  {showHtmlSource ? 'Visual editor' : 'HTML source'}
                </Button>
              </div>

              {showHtmlSource ? (
                <textarea
                  className="min-h-[220px] w-full rounded-xl border border-border/80 bg-background px-3 py-2 font-mono text-xs"
                  value={form.bodyHtml}
                  onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
                />
              ) : (
                <RichTextEditor
                  key={editing}
                  value={form.bodyHtml}
                  onChange={(html) => setForm((f) => ({ ...f, bodyHtml: html }))}
                />
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
                  {save.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                {editing !== 'new' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => duplicate.mutate(editing)}
                      disabled={duplicate.isPending}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => restore.mutate(editing)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Restore default
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => testSend.mutate(editing)}
                      disabled={testSend.isPending}
                    >
                      <Send className="mr-2 h-4 w-4" /> Send test
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm('Delete this template?')) remove.mutate(editing);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Branded preview</p>
                  <p className="text-xs text-muted-foreground">
                    {previewSubject || 'Subject will appear after preview'}
                  </p>
                </div>
                <div className="flex gap-1">
                  {(
                    [
                      ['desktop', Monitor],
                      ['tablet', Tablet],
                      ['mobile', Smartphone],
                    ] as const
                  ).map(([id, Icon]) => (
                    <Button
                      key={id}
                      type="button"
                      size="sm"
                      variant={device === id ? 'default' : 'outline'}
                      onClick={() => setDevice(id)}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => previewMut.mutate()}
                    disabled={previewMut.isPending}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="overflow-auto rounded-xl bg-slate-100 p-4 dark:bg-slate-900">
                <div
                  className="mx-auto overflow-hidden rounded-lg bg-white shadow"
                  style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}
                >
                  {previewHtml ? (
                    <iframe
                      title="Email preview"
                      sandbox=""
                      srcDoc={previewHtml}
                      className="h-[520px] w-full border-0 bg-white"
                    />
                  ) : (
                    <p className="p-6 text-sm text-muted-foreground">
                      Edit the template to see a live branded preview.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            Select a template or create a new one. Previews use institution branding automatically.
          </div>
        )}
      </div>
    </div>
  );
}
