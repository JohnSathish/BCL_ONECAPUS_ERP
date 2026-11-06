'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  CalendarRange,
  Check,
  Info,
  Landmark,
  Lightbulb,
  Loader2,
  Quote,
  Save,
  Settings2,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { DateInput } from '@/components/ui/date-input';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { fetchCycleDashboard } from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import {
  reopenStudentProfileUpdate,
  revokeStudentProfileUpdate,
  type ProfileSoftGate,
  type ProfileUpdatePolicy,
  type ProfileUpdateWindowSettings,
} from '@/services/student-profile-verification';
import { cn } from '@/utils/cn';
import { isoToDisplayDate } from '@/utils/format-date';
import { apiErrorMessage } from '@/utils/api-error';

const APPROVAL_MODES = [
  ['AUTO_APPROVE', 'Auto Approve'],
  ['APPROVAL_REQUIRED', 'Approval Required'],
  ['VERIFICATION_REQUIRED', 'Verification Required'],
  ['READ_ONLY', 'Read Only'],
] as const;

export function ProfileUpdatePolicyBoard({
  windowSettings,
  windowLoading,
  windowSaving,
  onSaveWindow,
  onReopenAll,
  gates,
  gatesLoading,
  gatesSaving,
  onSaveGates,
  policies,
  policiesLoading,
  policySaving,
  onChangeApproval,
  message,
}: {
  windowSettings?: ProfileUpdateWindowSettings;
  windowLoading: boolean;
  windowSaving: boolean;
  onSaveWindow: (payload: Partial<ProfileUpdateWindowSettings>) => void;
  onReopenAll: (payload: { startsAt?: string | null; endsAt: string }) => void;
  gates?: ProfileSoftGate;
  gatesLoading: boolean;
  gatesSaving: boolean;
  onSaveGates: (payload: Partial<ProfileSoftGate>) => void;
  policies: ProfileUpdatePolicy[];
  policiesLoading: boolean;
  policySaving: boolean;
  onChangeApproval: (row: ProfileUpdatePolicy, approvalMode: string) => void;
  message?: string;
}) {
  const { branding } = useInstitutionBranding();
  const institutions = useQuery({
    queryKey: ['org', 'institutions', 'profile-policy'],
    queryFn: fetchInstitutions,
    staleTime: 5 * 60_000,
  });
  const institutionId = institutions.data?.[0]?.id;
  const cycle = useQuery({
    queryKey: ['academic-lifecycle', 'dashboard', institutionId, 'profile-policy'],
    queryFn: () => fetchCycleDashboard(institutionId!),
    enabled: Boolean(institutionId),
    staleTime: 60_000,
  });

  const collegeName = branding?.displayName?.trim() || 'Don Bosco College, Tura';
  const subtitle = branding?.portalSubtitle?.trim() || 'Student Management System';
  const logo = resolveUploadAssetUrl(branding?.logoUrl) || branding?.logoUrl;
  const sessionName = cycle.data?.primarySession?.name?.trim();
  const ayLabel = sessionName
    ? sessionName.toUpperCase().startsWith('AY ')
      ? sessionName
      : `AY ${sessionName}`
    : null;
  const cycleLabel = cycle.data?.currentCycle ? `${cycle.data.currentCycle} Cycle` : null;
  const sessionActive = cycle.data?.primarySession?.status === 'ACTIVE';

  const windowValue = windowSettings ?? {
    enabled: false,
    startsAt: '',
    endsAt: '',
    closedMessage:
      'The profile update period has ended. Please contact the College Office if you need to make any changes.',
    bankSectionVisible: false,
  };
  const gateValue = gates ?? {
    enabled: false,
    minCompletionPercent: 80,
    remindOnLogin: true,
    softBlockRegistration: false,
    softBlockCertificates: false,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-10 w-10 object-contain" />
            ) : (
              <span className="text-[10px] font-bold text-blue-700">DBC</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{collegeName}</p>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ayLabel ? <ContextPill>{ayLabel}</ContextPill> : null}
          {cycleLabel ? <ContextPill>{cycleLabel}</ContextPill> : null}
          {sessionActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ACTIVE
            </span>
          ) : null}
          <Link
            href="/admin/reports/students"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Reports
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-800 via-blue-600 to-sky-500 px-5 py-5 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <UserRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Profile Update Policy</h1>
            <p className="mt-0.5 text-sm text-blue-50">
              Manage when and how students can update their profile information, and set related
              service restrictions.
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
        <WindowCard
          settings={windowValue}
          loading={windowLoading && !windowSettings}
          saving={windowSaving}
          onSave={onSaveWindow}
        />
        <div className="space-y-4">
          <OverviewCard windowSettings={windowValue} gates={gateValue} />
          <TipsCard />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReopenAllCard saving={windowSaving} onReopenAll={onReopenAll} />
        <ReopenOneCard />
      </div>

      <SoftGatesCard
        gates={gateValue}
        loading={gatesLoading && !gates}
        saving={gatesSaving}
        onSave={onSaveGates}
      />

      <FieldRulesCard
        policies={policies}
        loading={policiesLoading}
        saving={policySaving}
        onChangeApproval={onChangeApproval}
      />
    </div>
  );
}

function WindowCard({
  settings,
  loading,
  saving,
  onSave,
}: {
  settings: ProfileUpdateWindowSettings;
  loading: boolean;
  saving: boolean;
  onSave: (payload: Partial<ProfileUpdateWindowSettings>) => void;
}) {
  const [draft, setDraft] = useState<Partial<ProfileUpdateWindowSettings> | null>(null);
  const value = { ...settings, ...draft };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <CardHeading
        icon={CalendarRange}
        iconClass="bg-blue-50 text-blue-600"
        title="Profile Update Window"
        description="Allow students to edit their profile only within a specific period."
      />
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading update window…
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-3">
            <Switch
              checked={Boolean(value.enabled)}
              onChange={(enabled) => setDraft({ ...value, enabled })}
              label="Enable date window (allow student profile edits)"
            />
          </div>
          <p className="-mt-2 pl-14 text-xs text-slate-500">
            Students can update their profile only between the selected start and end dates.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldLabel label="Start Date">
              <DateInput
                value={value.startsAt ?? ''}
                onChange={(startsAt) => setDraft({ ...value, startsAt: startsAt || null })}
              />
            </FieldLabel>
            <FieldLabel label="End Date">
              <DateInput
                value={value.endsAt ?? ''}
                onChange={(endsAt) => setDraft({ ...value, endsAt: endsAt || null })}
              />
            </FieldLabel>
          </div>
          <FieldLabel label="Closed Message">
            <div className="relative">
              <Quote className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none ring-blue-200 focus:ring-2"
                value={value.closedMessage ?? ''}
                onChange={(event) => setDraft({ ...value, closedMessage: event.target.value })}
              />
            </div>
          </FieldLabel>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-blue-600"
              checked={Boolean(value.bankSectionVisible)}
              onChange={(event) => setDraft({ ...value, bankSectionVisible: event.target.checked })}
            />
            Show Bank Account Details to students (currently hidden by default)
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                enabled: Boolean(value.enabled),
                startsAt: value.startsAt || null,
                endsAt: value.endsAt || null,
                closedMessage: value.closedMessage,
                bankSectionVisible: Boolean(value.bankSectionVisible),
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Update Window
          </button>
        </div>
      )}
    </section>
  );
}

function OverviewCard({
  windowSettings,
  gates,
}: {
  windowSettings: ProfileUpdateWindowSettings;
  gates: ProfileSoftGate;
}) {
  const start = isoToDisplayDate(windowSettings.startsAt) || '—';
  const end = isoToDisplayDate(windowSettings.endsAt) || '—';
  const rows = [
    {
      icon: CalendarRange,
      label: 'Update Window',
      value: `${start} – ${end}`,
      tone: 'text-blue-700',
    },
    {
      icon: UserRound,
      label: 'Profile Editing',
      value: windowSettings.enabled ? 'Enabled' : 'Disabled',
      pill: windowSettings.enabled ? 'green' : 'slate',
    },
    {
      icon: Landmark,
      label: 'Bank Details Visibility',
      value: windowSettings.bankSectionVisible ? 'Visible' : 'Hidden',
      pill: windowSettings.bankSectionVisible ? 'green' : 'slate',
    },
    {
      icon: Bell,
      label: 'Login Reminders',
      value: gates.remindOnLogin !== false ? 'Enabled' : 'Off',
      pill: gates.remindOnLogin !== false ? 'green' : 'slate',
    },
    {
      icon: ShieldCheck,
      label: 'Minimum Completion',
      value: `${Number(gates.minCompletionPercent ?? 80)}%`,
      tone: 'text-blue-700',
    },
  ] as const;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <CardHeading
        icon={Info}
        iconClass="bg-blue-50 text-blue-600"
        title="Policy Overview"
        description="Current profile update and service settings at a glance."
      />
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-sm text-slate-600">
              <row.icon className="h-4 w-4 text-slate-400" />
              {row.label}
            </dt>
            <dd>
              {'pill' in row ? (
                <StatusPill tone={row.pill}>{row.value}</StatusPill>
              ) : (
                <span className={cn('text-sm font-semibold', row.tone)}>{row.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TipsCard() {
  const tips = [
    'Set a start and end date to control when students can edit their profile.',
    'Use Reopen for All Students to extend the deadline for everyone.',
    'Use Reopen for One Student for individual requests.',
    'Enable Soft Gates to encourage complete and accurate profiles.',
    'Set a minimum completion percentage (e.g., 80% or 100%).',
  ];
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
      <CardHeading icon={Lightbulb} iconClass="bg-amber-100 text-amber-600" title="Quick Tips" />
      <ul className="mt-3 space-y-2">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-sm text-slate-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            {tip}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReopenAllCard({
  saving,
  onReopenAll,
}: {
  saving: boolean;
  onReopenAll: (payload: { startsAt?: string | null; endsAt: string }) => void;
}) {
  const [reopenEndsAt, setReopenEndsAt] = useState('');
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <CardHeading
        icon={Users}
        iconClass="bg-violet-50 text-violet-600"
        title="Reopen for All Students"
        description="Reopen the profile update window for all students until a new end date."
      />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <FieldLabel label="New End Date" className="min-w-[180px] flex-1">
          <DateInput value={reopenEndsAt} onChange={setReopenEndsAt} />
        </FieldLabel>
        <button
          type="button"
          disabled={!reopenEndsAt || saving}
          onClick={() => onReopenAll({ endsAt: reopenEndsAt })}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Reopen All
        </button>
      </div>
    </section>
  );
}

function ReopenOneCard() {
  const [rollNumber, setRollNumber] = useState('');
  const [studentUntil, setStudentUntil] = useState('');
  const [studentMsg, setStudentMsg] = useState('');
  const [pending, setPending] = useState<'reopen' | 'revoke' | null>(null);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <CardHeading
        icon={UserRound}
        iconClass="bg-emerald-50 text-emerald-600"
        title="Reopen for One Student"
        description="Allow a specific student to update their profile."
      />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <FieldLabel label="Roll Number / Enrollment Number" className="min-w-[180px] flex-1">
          <input
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none ring-blue-200 focus:ring-2"
            placeholder="e.g. BA25-016"
            value={rollNumber}
            onChange={(event) => setRollNumber(event.target.value)}
          />
        </FieldLabel>
        <FieldLabel label="Valid Till" className="min-w-[160px]">
          <DateInput value={studentUntil} onChange={setStudentUntil} />
        </FieldLabel>
        <button
          type="button"
          disabled={!rollNumber.trim() || !studentUntil || pending !== null}
          onClick={async () => {
            setPending('reopen');
            try {
              const res = await reopenStudentProfileUpdate(rollNumber.trim(), {
                reopenUntil: studentUntil,
              });
              const name = (res as { student?: { name?: string } }).student?.name;
              const roll =
                (res as { student?: { rollNumber?: string } }).student?.rollNumber ??
                rollNumber.trim();
              setStudentMsg(
                name
                  ? `Reopened until ${isoToDisplayDate(studentUntil) || studentUntil} for ${name} (${roll})`
                  : `Reopened until ${isoToDisplayDate(studentUntil) || studentUntil} for ${roll}`,
              );
            } catch (error) {
              setStudentMsg(apiErrorMessage(error, 'Reopen failed'));
            } finally {
              setPending(null);
            }
          }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {pending === 'reopen' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserRound className="h-4 w-4" />
          )}
          Reopen Student
        </button>
      </div>
      {rollNumber.trim() ? (
        <button
          type="button"
          className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
          disabled={pending !== null}
          onClick={async () => {
            setPending('revoke');
            try {
              await revokeStudentProfileUpdate(rollNumber.trim());
              setStudentMsg(`Reopen revoked for ${rollNumber.trim()}`);
            } catch (error) {
              setStudentMsg(apiErrorMessage(error, 'Revoke failed'));
            } finally {
              setPending(null);
            }
          }}
        >
          {pending === 'revoke' ? 'Revoking…' : 'Revoke reopen'}
        </button>
      ) : null}
      {studentMsg ? <p className="mt-2 text-xs text-slate-600">{studentMsg}</p> : null}
    </section>
  );
}

function SoftGatesCard({
  gates,
  loading,
  saving,
  onSave,
}: {
  gates: ProfileSoftGate;
  loading: boolean;
  saving: boolean;
  onSave: (payload: Partial<ProfileSoftGate>) => void;
}) {
  const [draft, setDraft] = useState<Partial<ProfileSoftGate> | null>(null);
  const value = { ...gates, ...draft };
  const options = [
    {
      key: 'enabled' as const,
      title: 'Enable soft gates',
      hint: 'Show reminders for incomplete profile information.',
    },
    {
      key: 'softBlockRegistration' as const,
      title: 'Soft-block semester registration submit',
      hint: 'Restrict semester registration if profile is incomplete.',
    },
    {
      key: 'remindOnLogin' as const,
      title: 'Remind on login / profile home',
      hint: 'Show a reminder on student login and profile page.',
    },
    {
      key: 'softBlockCertificates' as const,
      title: 'Soft-block certificate requests',
      hint: 'Restrict certificate requests if profile is incomplete.',
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <CardHeading
        icon={Settings2}
        iconClass="bg-orange-50 text-orange-600"
        title="Soft Service Gates"
        description="Remind students and apply optional restrictions for incomplete profiles."
      />
      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading soft gates…
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {options.map((option) => (
              <label
                key={option.key}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                  checked={
                    option.key === 'remindOnLogin'
                      ? value.remindOnLogin !== false
                      : Boolean(value[option.key])
                  }
                  onChange={(event) => setDraft({ ...value, [option.key]: event.target.checked })}
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <FieldLabel label="Minimum Completion %">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="h-10 w-24 rounded-md border border-slate-200 px-3 text-sm outline-none ring-blue-200 focus:ring-2"
                  value={Number(value.minCompletionPercent ?? 80)}
                  onChange={(event) =>
                    setDraft({
                      ...value,
                      minCompletionPercent: Number(event.target.value || 0),
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-500">%</span>
              </div>
            </FieldLabel>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                onSave({
                  enabled: Boolean(value.enabled),
                  minCompletionPercent: Number(value.minCompletionPercent ?? 80),
                  remindOnLogin: value.remindOnLogin !== false,
                  softBlockRegistration: Boolean(value.softBlockRegistration),
                  softBlockCertificates: Boolean(value.softBlockCertificates),
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Soft Gates
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function FieldRulesCard({
  policies,
  loading,
  saving,
  onChangeApproval,
}: {
  policies: ProfileUpdatePolicy[];
  loading: boolean;
  saving: boolean;
  onChangeApproval: (row: ProfileUpdatePolicy, approvalMode: string) => void;
}) {
  const rows = policies.filter((row) => row.sectionKey !== '__settings__');
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Field approval rules</h2>
        <p className="text-xs text-slate-500">
          Choose how each student-edited field is handled. Changes save immediately.
        </p>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-blue-700 text-left text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Section</th>
              <th className="px-4 py-2.5 font-semibold">Field</th>
              <th className="px-4 py-2.5 font-semibold">Mode</th>
              <th className="px-4 py-2.5 font-semibold">Mandatory</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-700">{labelize(row.sectionKey)}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{labelize(row.fieldKey)}</td>
                <td className="px-4 py-2.5">
                  <select
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                    value={row.approvalMode}
                    disabled={saving}
                    onChange={(event) => onChangeApproval(row, event.target.value)}
                  >
                    {APPROVAL_MODES.map(([mode, label]) => (
                      <option key={mode} value={mode}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <StatusPill tone={row.mandatory ? 'green' : 'slate'}>
                    {row.mandatory ? 'Yes' : 'No'}
                  </StatusPill>
                </td>
              </tr>
            ))}
            {loading && !rows.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading field rules…
                </td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                  No field rules loaded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {saving ? (
        <p className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      ) : null}
    </section>
  );
}

function CardHeading({
  icon: Icon,
  iconClass,
  title,
  description,
}: {
  icon: typeof CalendarRange;
  iconClass: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconClass)}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition',
          checked ? 'bg-blue-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
            checked ? 'left-5' : 'left-0.5',
          )}
        />
      </span>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
    </button>
  );
}

function ContextPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
      {children}
    </span>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: 'green' | 'slate' }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
      )}
    >
      {children}
    </span>
  );
}

function labelize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
