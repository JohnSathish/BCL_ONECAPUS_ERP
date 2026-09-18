'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CalendarClock,
  Eye,
  FileText,
  ImagePlus,
  Link2,
  Paperclip,
  PencilLine,
  Send,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { previewSchoolPushAudience, uploadSchoolPushImage } from '@/services/school-push';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';

export const AUDIENCES = [
  ['MY_DEVICES', 'My signed-in app (test)'],
  ['INDIVIDUAL_STUDENT', 'Individual Student'],
  ['PARENT', 'Parent'],
  ['TEACHER', 'Teacher'],
  ['STAFF', 'Staff'],
  ['CLASS', 'Class'],
  ['SECTION', 'Section'],
  ['MULTI_CLASS', 'Multiple Classes'],
  ['MULTI_SECTION', 'Multiple Sections'],
  ['ALL_STUDENTS', 'All Students'],
  ['ALL_PARENTS', 'All Parents'],
  ['ALL_TEACHERS', 'All Teachers'],
  ['ALL_STAFF', 'All Staff'],
  ['CUSTOM', 'Custom Selection'],
] as const;

export const CATEGORIES = [
  'GENERAL',
  'ANNOUNCEMENT',
  'FEE',
  'ATTENDANCE',
  'EXAMINATION',
  'RESULT',
  'HOMEWORK',
  'HOLIDAY',
  'ACADEMIC_CALENDAR',
  'TRANSPORT',
  'EMERGENCY',
  'EVENT',
  'MEETING',
  'ADMISSION',
  'LIBRARY',
  'BIRTHDAY',
  'SYSTEM',
];

export const DEEP_LINKS = [
  'NONE',
  'DASHBOARD',
  'FEES',
  'ATTENDANCE',
  'EXAMINATION',
  'RESULT',
  'HOMEWORK',
  'NOTICES',
  'HOLIDAY',
  'ACADEMIC_CALENDAR',
  'TRANSPORT',
  'LIBRARY',
  'EVENT',
  'STUDENT',
  'DOCUMENT',
  'CUSTOM',
];

export type NotificationDraft = {
  title: string;
  body: string;
  category: string;
  priority: string;
  deepLinkType: string;
  deepLinkValue: string;
  imageUrl: string;
  attachmentName: string;
  attachmentKind: '' | 'image' | 'pdf';
  kind: string;
  gradeId: string;
  sectionId: string;
  studentIds: string[];
  studentQ: string;
  scheduledAt: string;
  sendMode: 'now' | 'schedule' | 'draft';
};

type Grade = { id: string; name: string };
type Section = { id: string; name: string; gradeId: string; grade: { name: string } };
type Student = { id: string; fullName: string; admissionNumber: string };

const fieldClass =
  'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

function pretty(value: string) {
  if (value === 'NONE') return 'None';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Step({
  n,
  icon: Icon,
  title,
  hint,
  extra,
  children,
}: {
  n: number;
  icon: typeof Users;
  title: string;
  hint: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-sm font-semibold text-white">
            {n}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-sky-500" />
              <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
          </div>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function DevicePreview({ draft, os }: { draft: NotificationDraft; os: 'android' | 'ios' }) {
  const now = useMemo(() => {
    const d = new Date();
    const time = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    });
    const date = d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    return { time, date };
  }, []);

  return (
    <div
      className={cn(
        'relative mx-auto w-[280px] overflow-hidden rounded-[2.4rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl',
        os === 'ios' ? 'rounded-[2.7rem]' : 'rounded-[2.4rem]',
      )}
    >
      <div
        className="relative h-[560px] bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(165deg, #2b4a9a 0%, #3d5cb8 28%, #6b7fd4 52%, #c4b5e8 78%, #8aa4e8 100%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_40%,rgba(255,255,255,0.18),transparent_42%)]" />
        {os === 'android' ? (
          <div className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-slate-950/80" />
        ) : (
          <div className="absolute left-1/2 top-2 h-6 w-24 -translate-x-1/2 rounded-full bg-slate-950" />
        )}
        <div className="relative flex items-center justify-between px-5 pt-7 text-[11px] font-medium text-white/90">
          <span>{now.time}</span>
          <span className="flex items-center gap-1 text-[10px]">
            <span className="inline-block h-2 w-3 rounded-[1px] border border-white/80" />
            <span className="inline-block h-2.5 w-4 rounded-sm border border-white/90">
              <span className="ml-[1px] mt-[1px] block h-1.5 w-2.5 rounded-[1px] bg-white/90" />
            </span>
          </span>
        </div>
        <div className="relative mx-3 mt-3 rounded-2xl bg-white/92 p-3 shadow-lg backdrop-blur">
          <div className="flex items-start gap-2.5">
            <img src={SCHOOL_SIS_LOGO_SRC} alt="" className="h-8 w-8 rounded-lg object-contain" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[11px] font-semibold text-slate-700">
                  St. Luke&apos;s Secondary School
                </p>
                <p className="shrink-0 text-[10px] text-slate-400">now</p>
              </div>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-900">
                {draft.title || 'Notification title'}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-600">
                {draft.body || 'Your message will appear here.'}
              </p>
            </div>
          </div>
          {draft.attachmentKind === 'image' && draft.imageUrl ? (
            <img src={draft.imageUrl} alt="" className="mt-2 h-24 w-full rounded-xl object-cover" />
          ) : null}
          {draft.attachmentKind === 'pdf' ? (
            <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] text-slate-600">
              PDF · {draft.attachmentName || 'Document'}
            </p>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-16 text-center text-white">
          <p className="text-6xl font-light tracking-tight">{now.time}</p>
          <p className="mt-1 text-sm font-medium text-white/90">{now.date}</p>
        </div>
        <div className="absolute bottom-4 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full bg-white/70" />
      </div>
    </div>
  );
}

export function NotificationComposer({
  open,
  onOpenChange,
  draft,
  setDraft,
  classes,
  students,
  sending,
  error,
  onError,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: NotificationDraft;
  setDraft: (next: NotificationDraft | ((s: NotificationDraft) => NotificationDraft)) => void;
  classes?: { grades?: Grade[]; sections?: Section[] };
  students?: Student[];
  sending: boolean;
  error: string | null;
  onError: (message: string | null) => void;
  onContinue: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [os, setOs] = useState<'android' | 'ios'>('android');
  const [uploading, setUploading] = useState(false);

  const audience = useMemo(() => {
    const base: Record<string, unknown> = { kind: draft.kind };
    if (draft.gradeId) base.gradeIds = [draft.gradeId];
    if (draft.sectionId) base.sectionIds = [draft.sectionId];
    if (draft.studentIds.length) base.studentIds = draft.studentIds;
    return base;
  }, [draft.kind, draft.gradeId, draft.sectionId, draft.studentIds]);

  const live = useQuery({
    queryKey: ['school-push-audience-live', audience],
    queryFn: () => previewSchoolPushAudience(audience),
    enabled: open,
  });

  const recipients = live.data?.recipients ?? 0;

  async function onFile(file: File) {
    setUploading(true);
    onError(null);
    try {
      const r = await uploadSchoolPushImage(file);
      setDraft((s) => ({
        ...s,
        imageUrl: r.url,
        attachmentKind: r.kind === 'pdf' ? 'pdf' : 'image',
        attachmentName: r.fileName || file.name,
      }));
    } catch (err) {
      onError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[min(1120px,96vw)] max-w-[1120px] flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 pr-12">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <Send className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                Send Notification
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm text-slate-500">
                Compose and send a message to your school community. Large broadcasts may take a few
                moments.
              </DialogDescription>
            </div>
          </div>
          <p className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 sm:flex">
            <Smartphone className="h-4 w-4" />
            Preview on device
          </p>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 space-y-3 overflow-y-auto bg-[#f7f9fc] p-4 sm:p-5">
            <Step
              n={1}
              icon={Users}
              title="Audience"
              hint="Select who will receive this notification."
              extra={
                <div className="rounded-xl bg-sky-50 px-3 py-1.5 text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-sky-500">
                    Total recipients
                  </p>
                  <p className="flex items-center justify-end gap-1 text-sm font-semibold text-sky-700">
                    <Users className="h-3.5 w-3.5" />
                    {live.isFetching ? '…' : recipients.toLocaleString('en-IN')}
                  </p>
                </div>
              }
            >
              <select
                className={fieldClass}
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              >
                {AUDIENCES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {['CLASS', 'MULTI_CLASS', 'SECTION', 'MULTI_SECTION'].includes(draft.kind) ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select
                    className={fieldClass}
                    value={draft.gradeId}
                    onChange={(e) => setDraft({ ...draft, gradeId: e.target.value })}
                  >
                    <option value="">Select class</option>
                    {(classes?.grades ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={fieldClass}
                    value={draft.sectionId}
                    onChange={(e) => setDraft({ ...draft, sectionId: e.target.value })}
                  >
                    <option value="">All sections</option>
                    {(classes?.sections ?? [])
                      .filter((s) => !draft.gradeId || s.gradeId === draft.gradeId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.grade.name} {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
              {['INDIVIDUAL_STUDENT', 'PARENT'].includes(draft.kind) ? (
                <div className="mt-2">
                  <input
                    className={fieldClass}
                    placeholder="Search name, admission no., roll no., parent mobile"
                    value={draft.studentQ}
                    onChange={(e) => setDraft({ ...draft, studentQ: e.target.value })}
                  />
                  <div className="mt-2 max-h-36 overflow-auto rounded-xl border border-slate-200 bg-white">
                    {(students ?? []).map((st) => (
                      <button
                        type="button"
                        key={st.id}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            studentIds: draft.studentIds.includes(st.id)
                              ? draft.studentIds
                              : [...draft.studentIds, st.id],
                          })
                        }
                      >
                        {st.fullName} · {st.admissionNumber}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{draft.studentIds.length} selected</p>
                </div>
              ) : null}
            </Step>

            <Step n={2} icon={FileText} title="Title" hint="Enter a short and clear title.">
              <div className="relative">
                <input
                  className={cn(fieldClass, 'pr-16')}
                  maxLength={100}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. Holiday notice"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  {draft.title.length} / 100
                </span>
              </div>
            </Step>

            <Step
              n={3}
              icon={PencilLine}
              title="Message"
              hint="Write your message. Keep it clear and concise."
            >
              <div className="relative">
                <textarea
                  className={cn(fieldClass, 'min-h-[120px] h-auto py-3 pr-16')}
                  maxLength={500}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="Type the notification message"
                />
                <span className="absolute bottom-3 right-3 text-xs text-slate-400">
                  {draft.body.length} / 500
                </span>
              </div>
            </Step>

            <Step
              n={4}
              icon={Bell}
              title="Additional options"
              hint="Set category, priority and optional link."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-slate-500">
                  Category
                  <select
                    className={fieldClass}
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {pretty(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-500">
                  Priority
                  <select
                    className={fieldClass}
                    value={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  >
                    <option>NORMAL</option>
                    <option>HIGH</option>
                    <option>URGENT</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-500">
                  Action
                  <select
                    className={fieldClass}
                    value={draft.deepLinkType}
                    onChange={(e) => setDraft({ ...draft, deepLinkType: e.target.value })}
                  >
                    {DEEP_LINKS.map((c) => (
                      <option key={c} value={c}>
                        {pretty(c)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="relative mt-3">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className={cn(fieldClass, 'pl-9')}
                  placeholder="Link value or custom URL (optional)"
                  value={draft.deepLinkValue}
                  onChange={(e) => setDraft({ ...draft, deepLinkValue: e.target.value })}
                />
              </div>
            </Step>

            <Step
              n={5}
              icon={Paperclip}
              title="Attachment (Image or PDF)"
              hint="Images appear on the lock screen. PDFs open when the user taps the notification (max 5 MB)."
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void onFile(file);
                }}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {draft.imageUrl ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    {draft.attachmentKind === 'pdf' ? (
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <FileText className="h-5 w-5" />
                      </span>
                    ) : (
                      <img
                        src={draft.imageUrl}
                        alt=""
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {draft.attachmentName || 'Attachment'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {draft.attachmentKind === 'pdf' ? 'PDF' : 'Image'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          imageUrl: '',
                          attachmentName: '',
                          attachmentKind: '',
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-400">
                    No file attached
                  </div>
                )}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50/60 px-3 py-4 text-center text-sm text-sky-700 hover:bg-sky-50"
                >
                  <ImagePlus className="mb-1 h-5 w-5" />
                  <span className="font-medium">
                    {uploading ? 'Uploading…' : 'Click to upload'}
                  </span>
                  <span className="text-xs text-sky-500">PNG, JPG, PDF (Max 5 MB)</span>
                </button>
              </div>
            </Step>

            <Step
              n={6}
              icon={CalendarClock}
              title="Schedule"
              hint="Choose when to send this notification."
            >
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                {(
                  [
                    ['now', 'Send now'],
                    ['schedule', 'Schedule for later'],
                    ['draft', 'Save as draft'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      className="h-4 w-4 accent-[#1e3a8a]"
                      checked={draft.sendMode === value}
                      onChange={() => setDraft({ ...draft, sendMode: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {draft.sendMode === 'schedule' ? (
                <input
                  type="datetime-local"
                  className={cn(fieldClass, 'mt-3 max-w-xs')}
                  value={draft.scheduledAt}
                  onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })}
                />
              ) : null}
            </Step>

            <div className="flex gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">
                i
              </span>
              <p>
                <span className="font-semibold">Please note</span>
                <br />
                Large broadcasts may take a few minutes to deliver. Recipients will receive the
                notification on their mobile app if notifications are enabled.
              </p>
            </div>
            {error ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <div className="lg:hidden">
              <p className="mb-2 text-sm font-semibold text-slate-800">Preview on device</p>
              <div className="mb-3 flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium w-fit">
                <button
                  type="button"
                  className={cn(
                    'rounded-md px-2.5 py-1',
                    os === 'android' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                  )}
                  onClick={() => setOs('android')}
                >
                  Android
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-md px-2.5 py-1',
                    os === 'ios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                  )}
                  onClick={() => setOs('ios')}
                >
                  iOS
                </button>
              </div>
              <DevicePreview draft={draft} os={os} />
            </div>
          </div>

          <aside className="hidden border-l border-slate-100 bg-white px-4 py-5 lg:block">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Eye className="h-4 w-4 text-sky-500" /> Preview
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  This is how your notification will appear on a mobile device.
                </p>
              </div>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  className={cn(
                    'rounded-md px-2.5 py-1',
                    os === 'android' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                  )}
                  onClick={() => setOs('android')}
                >
                  Android
                </button>
                <button
                  type="button"
                  className={cn(
                    'rounded-md px-2.5 py-1',
                    os === 'ios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
                  )}
                  onClick={() => setOs('ios')}
                >
                  iOS
                </button>
              </div>
            </div>
            <DevicePreview draft={draft} os={os} />
            <p className="mt-3 text-center text-[11px] text-slate-400">
              Appearance may vary based on device, OS version and app settings.
            </p>
          </aside>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          <GhostButton
            type="button"
            className="h-11 rounded-xl border border-slate-200 px-5"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </GhostButton>
          <PrimaryButton
            type="button"
            disabled={!draft.title || !draft.body || sending}
            className="h-11 rounded-xl bg-[#1e3a8a] px-5"
            onClick={onContinue}
          >
            <Send className="mr-2 h-4 w-4" />
            {draft.sendMode === 'draft'
              ? 'Save draft'
              : draft.sendMode === 'schedule'
                ? 'Schedule notification'
                : 'Send Notification'}
          </PrimaryButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
