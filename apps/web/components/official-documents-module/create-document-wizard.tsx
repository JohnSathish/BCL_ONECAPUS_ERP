'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Eye, Loader2, Sparkles } from 'lucide-react';

import { RichTextEditor } from '@/components/communication/compose/rich-text-editor';
import { OfficialDocumentsShell } from '@/components/official-documents-module/official-documents-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AUDIENCE_OPTIONS,
  approveOfficialDocument,
  createOfficialDocument,
  DOCUMENT_TYPE_OPTIONS,
  EXPIRY_RELEVANT_DOCUMENT_TYPES,
  fetchOfficialDocumentIssuers,
  fetchOfficialDocumentTemplates,
  previewOfficialDocumentPdf,
  SALUTATION_OPTIONS,
  SMART_VARIABLES,
  submitOfficialDocumentForApproval,
  type CreateOfficialDocumentPayload,
} from '@/services/official-documents';
import { fetchGovernanceCommittees } from '@/services/governance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const STEPS = ['Document Type', 'Issuer', 'Recipients', 'Details'] as const;
const PRIORITIES = ['NORMAL', 'IMPORTANT', 'URGENT', 'EMERGENCY'] as const;

type MeetingDraft = {
  title: string;
  date: string;
  time: string;
  venue: string;
  duration: string;
  convenedBy: string;
  chairperson: string;
  agendaText: string;
};

type PublishMode = 'draft' | 'now' | 'schedule';

const EMPTY_MEETING: MeetingDraft = {
  title: '',
  date: '',
  time: '',
  venue: '',
  duration: '',
  convenedBy: 'Principal',
  chairperson: '',
  agendaText: '',
};

const MEETING_STARTER_HTML = `<p>You are hereby informed that a meeting of the selected committee(s) will be held as per the meeting details above. All members are requested to attend without fail and come prepared with relevant documents.</p>`;

export function CreateDocumentWizard() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [documentType, setDocumentType] = useState('NOTICE');
  const [issuerId, setIssuerId] = useState('');
  const [audienceFlags, setAudienceFlags] = useState<Record<string, boolean>>({
    students: true,
    staff: true,
  });
  const [committeeIds, setCommitteeIds] = useState<string[]>([]);
  const [committeeSearch, setCommitteeSearch] = useState('');
  const [includeMembers, setIncludeMembers] = useState(true);
  const [meeting, setMeeting] = useState<MeetingDraft>(EMPTY_MEETING);
  const [title, setTitle] = useState('');
  const [salutation, setSalutation] = useState('Dear Faculty members and Students');
  const [customSalutation, setCustomSalutation] = useState(false);
  const [bodyHtml, setBodyHtml] = useState('<p></p>');
  const [priority, setPriority] = useState('NORMAL');
  const [expiryDate, setExpiryDate] = useState('');
  const [publishMode, setPublishMode] = useState<PublishMode>('draft');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const isCommitteeMeeting = documentType === 'COMMITTEE_MEETING';
  const isMeetingNotice = documentType === 'MEETING_NOTICE' || isCommitteeMeeting;
  const showCommittees = Boolean(audienceFlags.committee) || isCommitteeMeeting;
  const showExpiry = EXPIRY_RELEVANT_DOCUMENT_TYPES.has(documentType) && !isMeetingNotice;
  const showManualTitle = !isCommitteeMeeting;

  const issuers = useQuery({
    queryKey: ['official-documents', 'issuers'],
    queryFn: fetchOfficialDocumentIssuers,
  });

  const templates = useQuery({
    queryKey: ['official-documents', 'templates', documentType],
    queryFn: () => fetchOfficialDocumentTemplates(documentType),
    enabled: step >= 3,
  });

  const committeesQ = useQuery({
    queryKey: ['governance', 'committees', 'active-for-notices'],
    queryFn: () => fetchGovernanceCommittees({ status: 'ACTIVE', limit: 200, page: 1 }),
    enabled: showCommittees || step === 2,
  });

  const selectedIssuer = useMemo(
    () => (issuers.data ?? []).find((i) => i.id === issuerId),
    [issuers.data, issuerId],
  );

  const selectedCommittees = useMemo(() => {
    const items = committeesQ.data?.items ?? [];
    return items.filter((c) => committeeIds.includes(c.id));
  }, [committeesQ.data?.items, committeeIds]);

  const filteredCommittees = useMemo(() => {
    const items = committeesQ.data?.items ?? [];
    const q = committeeSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortCode.toLowerCase().includes(q) ||
        (c.category ?? '').toLowerCase().includes(q),
    );
  }, [committeesQ.data?.items, committeeSearch]);

  // Auto-select Principal (or first active issuer)
  useEffect(() => {
    if (issuerId || !issuers.data?.length) return;
    const principal =
      issuers.data.find((i) => /principal/i.test(i.roleCode) || /principal/i.test(i.designation)) ??
      issuers.data[0];
    if (principal) setIssuerId(principal.id);
  }, [issuers.data, issuerId]);

  useEffect(() => {
    if (isCommitteeMeeting) {
      setAudienceFlags((prev) => ({ ...prev, committee: true, students: false, staff: false }));
      setSalutation('Dear Committee Members');
      setCustomSalutation(false);
      setIncludeMembers(true);
      if (!bodyHtml || bodyHtml === '<p></p>') {
        setBodyHtml(MEETING_STARTER_HTML);
      }
    }
  }, [isCommitteeMeeting]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoTitle = useMemo(() => {
    if (isCommitteeMeeting && meeting.title.trim()) return meeting.title.trim();
    return title.trim();
  }, [isCommitteeMeeting, meeting.title, title]);

  const autoSubject = useMemo(() => {
    if (isCommitteeMeeting) {
      const names = selectedCommittees.map((c) => c.name);
      if (names.length === 1) return `Meeting of ${names[0]}`;
      if (names.length > 1) return `Meeting of ${names.join(' & ')}`;
      if (meeting.title.trim()) {
        const t = meeting.title.trim().replace(/\s+Meeting$/i, '');
        return `Meeting of ${t}`;
      }
      return 'Committee Meeting';
    }
    if (documentType === 'MEETING_NOTICE' && meeting.title.trim()) {
      return `Meeting — ${meeting.title.trim()}`;
    }
    return autoTitle || undefined;
  }, [isCommitteeMeeting, selectedCommittees, meeting.title, documentType, autoTitle]);

  const createMut = useMutation({
    mutationFn: async (payload: CreateOfficialDocumentPayload) => {
      const doc = await createOfficialDocument(payload);
      if (publishMode === 'now') {
        try {
          await submitOfficialDocumentForApproval(doc.id);
          await approveOfficialDocument(doc.id, 'Published from create wizard');
        } catch {
          // Draft + submitted is still success if approve not permitted
          try {
            await submitOfficialDocumentForApproval(doc.id);
          } catch {
            /* keep as draft */
          }
        }
      }
      return doc;
    },
    onSuccess: (doc) => {
      void qc.invalidateQueries({ queryKey: ['official-documents'] });
      router.push(`/admin/administration/official-documents/${doc.id}`);
    },
  });

  const previewMut = useMutation({
    mutationFn: (payload: CreateOfficialDocumentPayload) => previewOfficialDocumentPdf(payload),
    onSuccess: (blob) => {
      setPreviewError(null);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: (err) => {
      setPreviewError(apiErrorMessage(err, 'Could not generate preview'));
    },
  });

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = (templates.data ?? []).find((t) => t.id === id);
    if (!tpl) return;
    if (tpl.title && showManualTitle) setTitle(tpl.title);
    if (tpl.salutation) {
      setSalutation(tpl.salutation);
      setCustomSalutation(!(SALUTATION_OPTIONS as readonly string[]).includes(tpl.salutation));
    }
    setBodyHtml(tpl.bodyHtml);
  };

  const toggleCommittee = (id: string) => {
    setCommitteeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const audiencePayload = useMemo(() => {
    const base: Record<string, unknown> = { ...audienceFlags };
    if (showCommittees && committeeIds.length > 0) {
      base.committee = true;
      base.committeeIds = committeeIds;
      base.includeMembers = includeMembers;
    } else if (!audienceFlags.committee) {
      delete base.committee;
    }
    return base;
  }, [audienceFlags, committeeIds, includeMembers, showCommittees]);

  const printSettings = useMemo(() => {
    if (!isMeetingNotice && !meeting.title && !meeting.date) return undefined;
    const agenda = meeting.agendaText
      .split(/\n/)
      .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean);
    return {
      meeting: {
        title: meeting.title.trim() || autoTitle,
        date: meeting.date.trim(),
        time: meeting.time.trim(),
        venue: meeting.venue.trim(),
        duration: meeting.duration.trim(),
        convenedBy: meeting.convenedBy.trim(),
        chairperson: meeting.chairperson.trim(),
        agenda,
      },
    };
  }, [isMeetingNotice, meeting, autoTitle]);

  const scheduledAt = useMemo(() => {
    if (publishMode !== 'schedule' || !scheduleDate) return undefined;
    const time = scheduleTime.trim() || '09:00';
    return `${scheduleDate}T${time.length === 5 ? `${time}:00` : time}`;
  }, [publishMode, scheduleDate, scheduleTime]);

  const payload: CreateOfficialDocumentPayload = {
    documentType,
    title: autoTitle,
    subject: autoSubject,
    salutation: salutation.trim() || undefined,
    bodyHtml,
    priority,
    issuerId: issuerId || undefined,
    letterheadId: selectedIssuer?.letterhead?.id,
    audience: audiencePayload,
    printSettings,
    effectiveDate: isMeetingNotice && meeting.date ? meeting.date : undefined,
    expiryDate: showExpiry && expiryDate ? expiryDate : undefined,
    scheduledAt: publishMode === 'schedule' ? scheduledAt : undefined,
  };

  const canNext =
    step === 0
      ? Boolean(documentType)
      : step === 1
        ? Boolean(issuerId)
        : step === 2
          ? showCommittees
            ? committeeIds.length > 0
            : Object.values(audienceFlags).some(Boolean)
          : Boolean(
              autoTitle &&
              bodyHtml.trim() &&
              (!isCommitteeMeeting ||
                (meeting.title.trim() &&
                  meeting.date.trim() &&
                  meeting.time.trim() &&
                  meeting.venue.trim())),
            );

  const insertVariable = (v: string) => {
    setBodyHtml((html) => `${html}<p>${v}</p>`);
  };

  const departmentLabel = selectedIssuer
    ? /principal/i.test(selectedIssuer.designation) || /principal/i.test(selectedIssuer.roleCode)
      ? 'Office of the Principal'
      : /vice/i.test(selectedIssuer.designation)
        ? 'Office of the Vice Principal'
        : selectedIssuer.designation
    : '—';

  return (
    <OfficialDocumentsShell title="Create Document">
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Create Official Document</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reference number, department, date, signature, and seal are applied automatically.
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
                  : index < step
                    ? 'bg-muted text-foreground'
                    : 'bg-muted/50 text-muted-foreground',
              )}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/80 p-5">
          {step === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDocumentType(opt.value)}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm font-medium',
                    documentType === opt.value ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Issued by is selected from Digital Signatures. Reference number is assigned on
                publish.
              </p>
              {issuers.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading issuers…
                </p>
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
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Issued By
                    </span>
                    <span className="font-semibold">{issuer.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {issuer.designation}
                      {issuer.refPrefix ? ` · Ref ${issuer.refPrefix}/…` : ''}
                    </span>
                  </button>
                ))
              )}
              {selectedIssuer ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Department · </span>
                    {departmentLabel}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Reference number will be generated automatically on publish (e.g. DBCT/
                    {selectedIssuer.refPrefix || 'PR'}/2026/0008).
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {AUDIENCE_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(audienceFlags[opt.key])}
                      onChange={(e) =>
                        setAudienceFlags((prev) => ({
                          ...prev,
                          [opt.key]: e.target.checked,
                        }))
                      }
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {showCommittees ? (
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Select committees</p>
                      <p className="text-xs text-muted-foreground">
                        Members load automatically from Committee Master.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={includeMembers}
                        onChange={(e) => setIncludeMembers(e.target.checked)}
                      />
                      Include members table in PDF
                    </label>
                  </div>
                  <Input
                    placeholder="Search committees…"
                    value={committeeSearch}
                    onChange={(e) => setCommitteeSearch(e.target.value)}
                  />
                  {committeesQ.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading committees…</p>
                  ) : (
                    <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                      {filteredCommittees.map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm hover:border-border hover:bg-background"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={committeeIds.includes(c.id)}
                            onChange={() => toggleCommittee(c.id)}
                          />
                          <span>
                            <span className="font-medium">{c.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {c.shortCode}
                              {c.category ? ` · ${c.category}` : ''}
                            </span>
                          </span>
                        </label>
                      ))}
                      {filteredCommittees.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No active committees found. Create them under Governance → Committees.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              {/* Meeting Information */}
              {isMeetingNotice ? (
                <section className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
                  <p className="text-sm font-semibold">Meeting information</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                      <Label>Meeting title *</Label>
                      <Input
                        value={meeting.title}
                        onChange={(e) => setMeeting((m) => ({ ...m, title: e.target.value }))}
                        placeholder="Source Journal Editorial Board Meeting"
                      />
                      {isCommitteeMeeting && meeting.title.trim() ? (
                        <p className="text-[11px] text-muted-foreground">
                          Notice title &amp; subject are generated from this title and selected
                          committees.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label>Meeting date *</Label>
                      <Input
                        type="date"
                        value={meeting.date}
                        onChange={(e) => setMeeting((m) => ({ ...m, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Time *</Label>
                      <Input
                        value={meeting.time}
                        onChange={(e) => setMeeting((m) => ({ ...m, time: e.target.value }))}
                        placeholder="2:15 PM"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Venue *</Label>
                      <Input
                        value={meeting.venue}
                        onChange={(e) => setMeeting((m) => ({ ...m, venue: e.target.value }))}
                        placeholder="Conference Room"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Duration</Label>
                      <Input
                        value={meeting.duration}
                        onChange={(e) => setMeeting((m) => ({ ...m, duration: e.target.value }))}
                        placeholder="1 hour"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Convened by</Label>
                      <Input
                        value={meeting.convenedBy}
                        onChange={(e) => setMeeting((m) => ({ ...m, convenedBy: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Chairperson</Label>
                      <Input
                        value={meeting.chairperson}
                        onChange={(e) => setMeeting((m) => ({ ...m, chairperson: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>Agenda (one item per line)</Label>
                      <textarea
                        className="mt-1 min-h-[110px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        value={meeting.agendaText}
                        onChange={(e) => setMeeting((m) => ({ ...m, agendaText: e.target.value }))}
                        placeholder={'Journal Publication\nPaper Review\nAny Other Matter'}
                      />
                    </div>
                  </div>
                </section>
              ) : null}

              {/* Notice meta — only what is needed */}
              <section className="grid gap-3 md:grid-cols-2">
                {showManualTitle ? (
                  <div className="space-y-1 md:col-span-2">
                    <Label>Title *</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                ) : null}

                <div className="space-y-1 md:col-span-2">
                  <Label>Salutation</Label>
                  {!customSalutation ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                      value={
                        (SALUTATION_OPTIONS as readonly string[]).includes(salutation)
                          ? salutation
                          : ''
                      }
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setCustomSalutation(true);
                          return;
                        }
                        setSalutation(e.target.value);
                      }}
                    >
                      {SALUTATION_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="__custom__">Custom…</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={salutation}
                        onChange={(e) => setSalutation(e.target.value)}
                        placeholder="Custom salutation"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCustomSalutation(false);
                          setSalutation('Dear Committee Members');
                        }}
                      >
                        List
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Priority</Label>
                  <select
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {showExpiry ? (
                  <div className="space-y-1">
                    <Label>Expiry date</Label>
                    <Input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </div>
                ) : null}
              </section>

              {/* Notice body */}
              <section className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Notice body</p>
                    <p className="text-xs text-muted-foreground">
                      Templates insert starter content for this document type.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {templates.data?.length ? (
                      <select
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
                        value={templateId}
                        onChange={(e) => applyTemplate(e.target.value)}
                      >
                        <option value="">Apply template…</option>
                        {templates.data.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      Insert variable
                      <select
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            insertVariable(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">Select…</option>
                        {SMART_VARIABLES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
              </section>

              {/* Publish */}
              <section className="space-y-3 rounded-xl border border-border/70 p-4">
                <p className="text-sm font-semibold">Publish</p>
                <div className="flex flex-col gap-2 text-sm">
                  {(
                    [
                      { id: 'draft', label: 'Save draft' },
                      { id: 'now', label: 'Publish now' },
                      { id: 'schedule', label: 'Schedule later' },
                    ] as const
                  ).map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="publishMode"
                        checked={publishMode === opt.id}
                        onChange={() => setPublishMode(opt.id)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {publishMode === 'schedule' ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Publish date</Label>
                      <Input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Publish time</Label>
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
              </section>

              {(createMut.isError || previewError) && (
                <p className="text-sm text-destructive">
                  {previewError || apiErrorMessage(createMut.error, 'Could not create document')}
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canNext || previewMut.isPending}
                  onClick={() => {
                    setPreviewError(null);
                    previewMut.mutate(payload);
                  }}
                >
                  {previewMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  Preview PDF
                </Button>
                <Button
                  type="button"
                  disabled={!canNext || createMut.isPending}
                  onClick={() => createMut.mutate(payload)}
                >
                  {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {publishMode === 'draft'
                    ? 'Save draft'
                    : publishMode === 'now'
                      ? 'Publish'
                      : 'Schedule'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </OfficialDocumentsShell>
  );
}
