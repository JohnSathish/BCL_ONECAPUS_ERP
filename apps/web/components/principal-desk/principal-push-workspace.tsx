'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchPrincipalPushDetail,
  fetchPrincipalPushHistory,
  fetchPrincipalPushOptions,
  previewPrincipalPush,
  searchPrincipalPushPeople,
  sendPrincipalPush,
  type PrincipalPushAudience,
} from '@/services/principal-desk';
import { apiErrorMessage } from '@/utils/api-error';

const fieldClass =
  'mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';

function statusLabel(status: string, accepted: number, failed: number) {
  if (status === 'SCHEDULED') return 'Scheduled';
  if (status === 'SENDING') return 'Sending';
  if (status === 'FAILED') return 'Failed';
  if (status === 'CANCELLED') return 'Cancelled';
  if (accepted || failed) {
    return `FCM accepted ${accepted}${failed ? `, ${failed} failed` : ''}`;
  }
  if (status === 'SENT') return 'Accepted by FCM';
  return status;
}

export function PrincipalPushWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [audience, setAudience] = useState<PrincipalPushAudience>('STUDENTS_AND_STAFF');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [noticeLink, setNoticeLink] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [semesterSequences, setSemesterSequences] = useState<number[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<Array<{ id: string; name: string }>>([]);
  const [staffIds, setStaffIds] = useState<Array<{ id: string; name: string }>>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState('');

  const optionsQ = useQuery({
    queryKey: ['principal-push', 'options'],
    queryFn: fetchPrincipalPushOptions,
    enabled,
  });
  const historyQ = useQuery({
    queryKey: ['principal-push', 'history'],
    queryFn: fetchPrincipalPushHistory,
    enabled,
  });
  const peopleQ = useQuery({
    queryKey: ['principal-push', 'people', query],
    queryFn: () => searchPrincipalPushPeople(query),
    enabled: enabled && query.trim().length >= 2,
  });
  const detailQ = useQuery({
    queryKey: ['principal-push', 'detail', selectedId],
    queryFn: () => fetchPrincipalPushDetail(selectedId),
    enabled: enabled && Boolean(selectedId),
  });

  const payload = useMemo(
    () => ({
      audience,
      title: title.trim() || 'Preview',
      message: message.trim() || 'Preview',
      noticeLink: noticeLink.trim() || undefined,
      departmentIds: departmentIds.length ? departmentIds : undefined,
      semesterSequences: semesterSequences.length ? semesterSequences : undefined,
      sectionIds: sectionIds.length ? sectionIds : undefined,
      studentIds: studentIds.length ? studentIds.map((row) => row.id) : undefined,
      staffProfileIds: staffIds.length ? staffIds.map((row) => row.id) : undefined,
    }),
    [
      audience,
      departmentIds,
      message,
      noticeLink,
      sectionIds,
      semesterSequences,
      staffIds,
      studentIds,
      title,
    ],
  );

  const previewQ = useQuery({
    queryKey: ['principal-push', 'preview', payload],
    queryFn: () => previewPrincipalPush(payload),
    enabled,
  });

  const sendMut = useMutation({
    mutationFn: () =>
      sendPrincipalPush({
        ...payload,
        title: title.trim(),
        message: message.trim(),
        scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      }),
    onSuccess: (result) => {
      setNotice(
        result.status === 'SCHEDULED'
          ? 'Notification scheduled. It will be sent through FCM at that time.'
          : `Sending to ${result.recipients} people (${result.devices} with a registered device).`,
      );
      setTitle('');
      setMessage('');
      void qc.invalidateQueries({ queryKey: ['principal-push', 'history'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'Could not send the notification')),
  });

  const options = optionsQ.data;
  const sections = (options?.sections ?? []).filter((row) =>
    semesterSequences.length ? semesterSequences.includes(row.semesterNo ?? -1) : true,
  );

  return (
    <PrincipalDeskShell
      title="Send Push Notification"
      subtitle="This goes to the Bosco Connect app. Create Notice still sends email."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <form
          className="space-y-4 rounded-2xl border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setNotice('');
            sendMut.mutate();
          }}
        >
          {options && !options.fcmConfigured ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Push notifications are not configured on the server (FCM).
            </p>
          ) : null}
          {options?.fcmDemoMode ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              FCM is in demo mode. Messages are recorded and are not delivered to phones.
            </p>
          ) : null}
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-muted-foreground">
              Recipients
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(options?.audiences ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    audience === item.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border'
                  }`}
                  onClick={() => setAudience(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block text-xs text-muted-foreground">
            Departments
            <select
              multiple
              className={`${fieldClass} h-28`}
              value={departmentIds}
              onChange={(event) =>
                setDepartmentIds([...event.target.selectedOptions].map((option) => option.value))
              }
            >
              {(options?.departments ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          {audience !== 'STAFF' ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Semesters</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(options?.semesters ?? []).map((semester) => (
                    <button
                      key={semester}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs ${
                        semesterSequences.includes(semester)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border'
                      }`}
                      onClick={() =>
                        setSemesterSequences((current) =>
                          current.includes(semester)
                            ? current.filter((item) => item !== semester)
                            : [...current, semester],
                        )
                      }
                    >
                      Semester {semester}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-xs text-muted-foreground">
                Classes
                <select
                  multiple
                  className={`${fieldClass} h-28`}
                  value={sectionIds}
                  onChange={(event) =>
                    setSectionIds([...event.target.selectedOptions].map((option) => option.value))
                  }
                >
                  {sections.map((row) => (
                    <option key={row.id} value={row.id}>
                      Sem {row.semesterNo ?? '—'} · {row.courseCode} · {row.sectionCode}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="block text-xs text-muted-foreground">
            Find a student or staff member
            <input
              className={fieldClass}
              value={query}
              placeholder="Name, roll, or employee code"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {audience !== 'STAFF'
              ? (peopleQ.data?.students ?? []).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs"
                    onClick={() => {
                      setStudentIds((current) =>
                        current.some((item) => item.id === row.id)
                          ? current
                          : [...current, { id: row.id, name: row.name }],
                      );
                      setQuery('');
                    }}
                  >
                    {row.name}
                    {row.rollNumber ? ` · ${row.rollNumber}` : ''}
                  </button>
                ))
              : null}
            {audience !== 'STUDENTS'
              ? (peopleQ.data?.staff ?? []).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs"
                    onClick={() => {
                      setStaffIds((current) =>
                        current.some((item) => item.id === row.id)
                          ? current
                          : [...current, { id: row.id, name: row.name }],
                      );
                      setQuery('');
                    }}
                  >
                    {row.name} · {row.employeeCode}
                  </button>
                ))
              : null}
          </div>
          {studentIds.length || staffIds.length ? (
            <p className="text-xs text-muted-foreground">
              Named people are the only recipients. Department and semester filters stay unused.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {studentIds.map((row) => (
              <button
                key={row.id}
                type="button"
                className="rounded-full bg-slate-100 px-3 py-1 text-xs"
                onClick={() =>
                  setStudentIds((current) => current.filter((item) => item.id !== row.id))
                }
              >
                {row.name} ×
              </button>
            ))}
            {staffIds.map((row) => (
              <button
                key={row.id}
                type="button"
                className="rounded-full bg-slate-100 px-3 py-1 text-xs"
                onClick={() =>
                  setStaffIds((current) => current.filter((item) => item.id !== row.id))
                }
              >
                {row.name} ×
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {previewQ.data
              ? `${previewQ.data.total} people match. ${previewQ.data.withPush} have a registered device.`
              : 'Checking recipients…'}
          </p>
          <label className="block text-xs text-muted-foreground">
            Title
            <input
              className={fieldClass}
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Message
            <textarea
              className={`${fieldClass} min-h-28`}
              value={message}
              maxLength={1000}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Optional notice link
            <input
              className={fieldClass}
              value={noticeLink}
              placeholder="https://"
              onChange={(e) => setNoticeLink(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={schedule}
              onChange={(e) => setSchedule(e.target.checked)}
            />
            Schedule for later
          </label>
          {schedule ? (
            <input
              type="datetime-local"
              className={fieldClass}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          ) : null}
          {notice ? <p className="text-sm">{notice}</p> : null}
          <Button type="submit" disabled={sendMut.isPending || !title.trim() || !message.trim()}>
            {sendMut.isPending ? 'Sending…' : schedule ? 'Schedule notification' : 'Send now'}
          </Button>
        </form>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Sent notifications</h2>
          {(historyQ.data ?? []).map((row) => (
            <button
              key={row.id}
              type="button"
              className="block w-full rounded-xl border border-border px-3 py-2 text-left"
              onClick={() => setSelectedId(row.id)}
            >
              <p className="font-semibold">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                {row.audienceLabel} · {row.sender} ·{' '}
                {new Date(row.createdAt).toLocaleString('en-IN')}
              </p>
              <p className="text-xs">
                {statusLabel(row.status, row.acceptedByFcm, row.failed)}
                {row.skipped ? ` · ${row.skipped} skipped` : ''}
              </p>
            </button>
          ))}
          {!historyQ.data?.length ? (
            <p className="text-sm text-muted-foreground">No push notifications sent yet.</p>
          ) : null}
          {detailQ.data?.failures?.length ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
              <p className="font-semibold">Failed deliveries</p>
              {detailQ.data.failures.map((row, index) => (
                <p key={`${row.name}-${index}`} className="mt-1">
                  {row.name}: {row.error}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </PrincipalDeskShell>
  );
}
