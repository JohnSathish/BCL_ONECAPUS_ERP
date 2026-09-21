'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { SmsPanel } from './sms-ui';
import {
  fetchSmsConfiguration,
  previewSms,
  previewSmsRecipients,
  searchSmsStudents,
  sendSmsCampaign,
  testSmsGateway,
  type SmsStudentMatch,
} from '@/services/school-sms';

function templateVars(body: string) {
  return [...body.matchAll(/\{([a-z0-9_]+)\}/gi)].map((m) => m[1]!.toLowerCase());
}

const STUDENT_VARS = new Set([
  'student_name',
  'parent_name',
  'class',
  'class_name',
  'section',
  'admission_no',
  'school_name',
]);

export function SmsSendPanel({
  onNotice,
  onError,
}: {
  onNotice: (msg: string) => void;
  onError: (err: unknown) => void;
}) {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [body, setBody] = useState(
    "Dear {parent_name}, fee of Rs.{amount} for {student_name}, {class_name} is pending. - St. Luke's School",
  );
  const [search, setSearch] = useState('');
  const [audienceType, setAudienceType] = useState('INDIVIDUAL');
  const [recipient, setRecipient] = useState<'PARENT' | 'STUDENT'>('PARENT');
  const [selected, setSelected] = useState<SmsStudentMatch | null>(null);
  const [extraVars, setExtraVars] = useState<Record<string, string>>({ amount: '3600' });
  const [confirm, setConfirm] = useState<Record<string, unknown> | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const config = useQuery({
    queryKey: ['sms-cfg'],
    queryFn: fetchSmsConfiguration,
    enabled: ready,
  });
  const preview = useQuery({
    queryKey: ['sms-prev', body, extraVars, selected?.studentId],
    queryFn: () =>
      previewSms({
        template: body,
        variables: {
          parent_name: selected?.parentName || 'Mary',
          amount: extraVars.amount || '3600',
          student_name: selected?.fullName || 'Adrian D. Sangma',
          class_name: selected?.classLabel || 'VIII A',
          ...extraVars,
        },
      }),
    enabled: ready,
  });
  const students = useQuery({
    queryKey: ['sms-stu', debouncedSearch, recipient],
    queryFn: () => searchSmsStudents(debouncedSearch, recipient),
    enabled: ready && audienceType === 'INDIVIDUAL' && debouncedSearch.trim().length >= 2,
  });

  const segs = preview.data as
    | { chars?: number; segments?: number; preview?: string; missing?: string[] }
    | undefined;
  const cfg = config.data;
  const canSend = Boolean(cfg?.canSend);
  const issues = cfg?.issues ?? [];
  const gwId = typeof cfg?.gateway?.id === 'string' ? cfg.gateway.id : '';
  const extraKeys = useMemo(() => templateVars(body).filter((k) => !STUDENT_VARS.has(k)), [body]);

  const sendMut = useMutation({
    mutationFn: () =>
      sendSmsCampaign({
        name: audienceType === 'INDIVIDUAL' ? 'Individual SMS' : 'Office SMS',
        category: 'GENERAL',
        smsKind: 'SERVICE',
        body,
        sendNow: true,
        variables: extraVars,
        audience:
          audienceType === 'INDIVIDUAL'
            ? {
                type: 'INDIVIDUAL',
                recipient,
                studentIds: selected ? [selected.studentId] : [],
              }
            : {
                type: audienceType,
                recipient,
                search: search || undefined,
              },
      }),
    onSuccess: (res) => {
      setConfirm(null);
      const campaign = (res as { campaign?: { id?: string; recipientCount?: number } })?.campaign;
      onNotice(
        `SMS queued${campaign?.recipientCount ? ` for ${campaign.recipientCount} recipient(s)` : ''}. Gateway acceptance is stored as submitted; delivery updates from the callback.`,
      );
      void qc.invalidateQueries({ queryKey: ['sms-dash'] });
      void qc.invalidateQueries({ queryKey: ['sms-msg'] });
      void qc.invalidateQueries({ queryKey: ['sms-cfg'] });
    },
    onError,
  });

  const testMut = useMutation({
    mutationFn: () => testSmsGateway(gwId),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['sms-cfg'] });
      void qc.invalidateQueries({ queryKey: ['sms-gw'] });
      const credits = res.credits != null ? ` Credits: ${String(res.credits)}.` : '';
      const extra =
        Array.isArray(res.issues) && res.issues.length ? ` ${res.issues.join(' ')}` : '';
      onNotice(
        res.connected
          ? `Gateway connected (${String(res.provider)}).${credits}${extra}`
          : `Gateway test finished.${extra || ' Check configuration items below.'}`,
      );
    },
    onError,
  });

  function review() {
    if (audienceType === 'INDIVIDUAL') {
      if (!selected) {
        onNotice('Search and select a student first.');
        return;
      }
      const mobile =
        recipient === 'STUDENT'
          ? selected.studentMobile
          : selected.parentMobile || selected.studentMobile;
      if (!mobile) {
        onNotice('Selected student has no registered mobile for the chosen recipient.');
        return;
      }
      void previewSmsRecipients({
        type: 'INDIVIDUAL',
        recipient,
        studentIds: [selected.studentId],
        category: 'GENERAL',
      })
        .then((r) => setConfirm(r))
        .catch(onError);
      return;
    }
    void previewSmsRecipients({
      type: audienceType,
      recipient,
      search,
      category: 'GENERAL',
    })
      .then((r) => setConfirm(r))
      .catch(onError);
  }

  const matches = students.data?.items ?? [];

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <SmsPanel title="Composer">
          <div className="space-y-3">
            <ConfigBanner
              loading={config.isLoading}
              canSend={canSend}
              issues={issues}
              gateway={cfg?.gateway ?? null}
              credits={cfg?.credits?.manualBalance}
              callback={cfg?.deliveryCallback?.path}
              dltHeader={
                typeof cfg?.dlt?.approvedHeader === 'string' ? cfg.dlt.approvedHeader : null
              }
              onTest={() => (gwId ? testMut.mutate() : onNotice('No gateway to test.'))}
              testing={testMut.isPending}
            />
            <select
              value={audienceType}
              onChange={(e) => {
                setAudienceType(e.target.value);
                setSelected(null);
                setConfirm(null);
              }}
              className="w-full rounded-lg px-3 py-2 text-sm"
            >
              {['INDIVIDUAL', 'CLASS', 'SECTION', 'STAFF', 'CUSTOM'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {audienceType === 'INDIVIDUAL' ? (
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelected(null);
                  }}
                  placeholder="Search name, admission no, roll, class/section, or mobile"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                />
                {debouncedSearch.trim().length >= 2 && !selected ? (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-white shadow-lg">
                    {students.isFetching ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>
                    ) : matches.length ? (
                      matches.map((s) => (
                        <button
                          key={s.studentId}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            setSelected(s);
                            setSearch(`${s.fullName} · ${s.admissionNumber}`);
                          }}
                        >
                          <span className="font-medium">{s.fullName}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {s.admissionNumber}
                            {s.rollNumber ? ` · Roll ${s.rollNumber}` : ''}
                            {s.classLabel ? ` · ${s.classLabel}` : ''}
                            {' · '}
                            {s.recipientMobileDisplay || 'No mobile'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-slate-500">No matching students.</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student / admission / mobile"
                className="w-full rounded-lg px-3 py-2 text-sm"
              />
            )}
            {selected ? (
              <div className="rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium">{selected.fullName}</p>
                <p className="text-xs text-slate-500">
                  Adm {selected.admissionNumber}
                  {selected.rollNumber ? ` · Roll ${selected.rollNumber}` : ''}
                  {selected.classLabel ? ` · ${selected.classLabel}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={recipient === 'PARENT'}
                      onChange={() => setRecipient('PARENT')}
                    />
                    Parent {selected.parentMobileDisplay || '—'}
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={recipient === 'STUDENT'}
                      onChange={() => setRecipient('STUDENT')}
                    />
                    Student {selected.studentMobileDisplay || '—'}
                  </label>
                </div>
              </div>
            ) : null}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-lg px-3 py-2 text-sm"
            />
            {extraKeys.map((key) => (
              <input
                key={key}
                value={extraVars[key] ?? ''}
                onChange={(e) => setExtraVars((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={`Value for {${key}}`}
                className="w-full rounded-lg px-3 py-2 text-sm"
              />
            ))}
            <p className="text-xs" style={{ color: 'var(--muted-foreground-hex, #64748b)' }}>
              {segs?.chars ?? 0} characters · {segs?.segments ?? 1} SMS segment
              {segs?.missing?.length ? ` · missing {${segs.missing.join(', ')}}` : ''}
            </p>
            <PrimaryButton type="button" onClick={review}>
              Review recipients
            </PrimaryButton>
          </div>
        </SmsPanel>
        <SmsPanel title="Phone preview">
          <div
            className="mx-auto w-64 rounded-[2rem] p-4 text-sm text-white shadow-lg"
            style={{ background: 'var(--heading, #0f172a)' }}
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              St. Luke&apos;s School
            </p>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed">
              {String(segs?.preview ?? body)}
            </p>
          </div>
        </SmsPanel>
      </div>
      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Confirm SMS</h2>
            {selected ? (
              <p className="text-sm text-slate-600">
                {selected.fullName} · {recipient === 'PARENT' ? 'Parent' : 'Student'} ·{' '}
                {recipient === 'PARENT'
                  ? selected.parentMobileDisplay || selected.recipientMobileDisplay
                  : selected.studentMobileDisplay || selected.recipientMobileDisplay}
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Recipients: {String(confirm.valid)} · Missing: {String(confirm.missing)} · Segments:{' '}
                {segs?.segments ?? 1}
              </p>
            )}
            {!canSend ? (
              <ul className="list-disc space-y-1 pl-4 text-sm text-rose-700">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">
                Messages are queued. Gateway acceptance is not treated as delivered until the
                callback arrives.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <GhostButton type="button" onClick={() => setConfirm(null)}>
                Cancel
              </GhostButton>
              <PrimaryButton
                type="button"
                disabled={sendMut.isPending || !canSend}
                onClick={() => sendMut.mutate()}
              >
                Confirm & send
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConfigBanner({
  loading,
  canSend,
  issues,
  gateway,
  credits,
  callback,
  dltHeader,
  onTest,
  testing,
}: {
  loading: boolean;
  canSend: boolean;
  issues: string[];
  gateway: Record<string, unknown> | null;
  credits?: number;
  callback?: string;
  dltHeader?: string | null;
  onTest: () => void;
  testing: boolean;
}) {
  if (loading) {
    return <p className="text-xs text-slate-500">Checking SMS configuration…</p>;
  }
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs"
      style={{
        borderColor: canSend ? '#bbf7d0' : '#fecaca',
        background: canSend ? '#f0fdf4' : '#fff1f2',
        color: canSend ? '#14532d' : '#9f1239',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {canSend ? 'SMS gateway ready' : 'SMS configuration incomplete'}
          </p>
          <p className="mt-1 opacity-90">
            {gateway
              ? `${String(gateway.provider)} · sender ${String(gateway.senderId || '—')} · ${
                  gateway.hasCredentials ? 'credentials set' : 'credentials missing'
                }${gateway.apiHost ? ` · ${String(gateway.apiHost)}` : ''}${
                  gateway.route ? ` · ${String(gateway.route)}` : ''
                }${dltHeader ? ` · DLT ${dltHeader}` : ''} · credits ${Number(credits ?? 0).toLocaleString('en-IN')}`
              : 'No gateway configured.'}
          </p>
          {callback ? <p className="mt-1 opacity-80">Delivery callback: {callback}</p> : null}
          {!canSend ? (
            <>
              <ul className="mt-1 list-disc pl-4">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <p className="mt-2">
                <Link href="/admin/school-sis/sms/settings" className="font-semibold underline">
                  Open Send SMS settings
                </Link>
              </p>
            </>
          ) : null}
        </div>
        <GhostButton type="button" disabled={testing || !gateway} onClick={onTest}>
          {testing ? 'Testing…' : 'Test connection'}
        </GhostButton>
      </div>
    </div>
  );
}
