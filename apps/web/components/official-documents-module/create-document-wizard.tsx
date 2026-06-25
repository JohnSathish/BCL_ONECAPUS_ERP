'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';

import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { OfficialDocumentsShell } from '@/components/official-documents-module/official-documents-shell';
import { Button } from '@/components/ui/button';
import {
  AUDIENCE_OPTIONS,
  createOfficialDocument,
  DOCUMENT_TYPE_OPTIONS,
  fetchOfficialDocumentIssuers,
  fetchOfficialDocumentTemplates,
  SMART_VARIABLES,
  type CreateOfficialDocumentPayload,
} from '@/services/official-documents';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const STEPS = ['Document Type', 'Issuer', 'Audience', 'Details'] as const;
const PRIORITIES = ['NORMAL', 'IMPORTANT', 'URGENT', 'EMERGENCY'] as const;

export function CreateDocumentWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [documentType, setDocumentType] = useState('NOTICE');
  const [issuerId, setIssuerId] = useState('');
  const [audience, setAudience] = useState<Record<string, boolean>>({
    students: true,
    staff: true,
  });
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [salutation, setSalutation] = useState('Dear Faculty members and Students');
  const [bodyHtml, setBodyHtml] = useState('<p></p>');
  const [priority, setPriority] = useState('NORMAL');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [templateId, setTemplateId] = useState('');

  const issuers = useQuery({
    queryKey: ['official-documents', 'issuers'],
    queryFn: fetchOfficialDocumentIssuers,
  });

  const templates = useQuery({
    queryKey: ['official-documents', 'templates', documentType],
    queryFn: () => fetchOfficialDocumentTemplates(documentType),
    enabled: step >= 3,
  });

  const selectedIssuer = useMemo(
    () => (issuers.data ?? []).find((i) => i.id === issuerId),
    [issuers.data, issuerId],
  );

  const createMut = useMutation({
    mutationFn: (payload: CreateOfficialDocumentPayload) => createOfficialDocument(payload),
    onSuccess: (doc) => {
      void qc.invalidateQueries({ queryKey: ['official-documents'] });
      router.push(`/admin/administration/official-documents/${doc.id}`);
    },
  });

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = (templates.data ?? []).find((t) => t.id === id);
    if (!tpl) return;
    if (tpl.title) setTitle(tpl.title);
    if (tpl.subject) setSubject(tpl.subject);
    if (tpl.salutation) setSalutation(tpl.salutation);
    setBodyHtml(tpl.bodyHtml);
  };

  const payload: CreateOfficialDocumentPayload = {
    documentType,
    title: title.trim(),
    subject: subject.trim() || undefined,
    salutation: salutation.trim() || undefined,
    bodyHtml,
    priority,
    issuerId: issuerId || undefined,
    letterheadId: selectedIssuer?.letterhead?.id,
    audience,
    effectiveDate: effectiveDate || undefined,
    expiryDate: expiryDate || undefined,
    scheduledAt: scheduledAt || undefined,
  };

  const canNext =
    step === 0
      ? Boolean(documentType)
      : step === 1
        ? Boolean(issuerId)
        : step === 2
          ? true
          : Boolean(title.trim() && bodyHtml.trim());

  return (
    <OfficialDocumentsShell title="Create Document">
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Create Official Document</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Step-by-step wizard. Reference number and date are assigned automatically on approval.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold',
                index === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/85 p-5">
          {step === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDocumentType(opt.value)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm transition',
                    documentType === opt.value
                      ? 'border-primary bg-primary/5 font-semibold'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              {issuers.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading issuers…</p>
              ) : (
                (issuers.data ?? []).map((issuer) => (
                  <button
                    key={issuer.id}
                    type="button"
                    onClick={() => setIssuerId(issuer.id)}
                    className={cn(
                      'flex w-full flex-col rounded-xl border px-4 py-3 text-left',
                      issuerId === issuer.id ? 'border-primary bg-primary/5' : 'border-border',
                    )}
                  >
                    <span className="font-semibold">{issuer.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {issuer.designation}
                      {issuer.refPrefix ? ` · Ref prefix ${issuer.refPrefix}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {AUDIENCE_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(audience[opt.key])}
                    onChange={(e) =>
                      setAudience((prev) => ({ ...prev, [opt.key]: e.target.checked }))
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {templates.data?.length ? (
                <label className="block text-xs font-medium">
                  Apply template
                  <select
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">— Select template —</option>
                    {templates.data.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs font-medium">
                  Title *
                  <input
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium">
                  Subject
                  <input
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium md:col-span-2">
                  Salutation
                  <input
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                    value={salutation}
                    onChange={(e) => setSalutation(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium">
                  Priority
                  <select
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium">
                  Effective Date
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">Content</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Smart variables:
                  </span>
                  {SMART_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono"
                      onClick={() => setBodyHtml((prev) => `${prev}${v}`)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              size="sm"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!canNext || createMut.isPending}
              onClick={() => createMut.mutate(payload)}
            >
              {createMut.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Draft'
              )}
            </Button>
          )}
        </div>

        {createMut.isError ? (
          <p className="text-sm text-destructive">
            {apiErrorMessage(createMut.error, 'Failed to create document')}
          </p>
        ) : null}
      </div>
    </OfficialDocumentsShell>
  );
}
