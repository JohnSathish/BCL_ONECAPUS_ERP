'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  MapPin,
  Pencil,
  Phone,
  Shield,
  UserRound,
  Users,
} from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import {
  fetchMyEmergencyContacts,
  fetchMyProfileHistory,
  fetchMyStaffDocumentCompliance,
} from '@/services/staff';
import type { StaffMeProfile } from '@/types/staff-portal';
import { cn } from '@/utils/cn';

function maskId(value?: string | null, keep = 4): string {
  const v = (value ?? '').replace(/\s+/g, '');
  if (!v) return '—';
  if (v.length <= keep) return '•'.repeat(v.length);
  return `${'X'.repeat(Math.min(8, v.length - keep))} ${v.slice(-keep)}`;
}

function InfoRow({
  label,
  value,
  badge,
}: {
  label: string;
  value?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-50 py-2 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex max-w-[60%] flex-col items-end gap-1 text-right">
        <span className="text-xs font-medium text-slate-800">{value || '—'}</span>
        {badge}
      </div>
    </div>
  );
}

function CardShell({
  title,
  icon,
  iconClass,
  action,
  children,
  footer,
}: {
  title: string;
  icon: React.ReactNode;
  iconClass: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <GlassCard className="flex h-full flex-col rounded-[18px] border-slate-200/80 p-0 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', iconClass)}>
            {icon}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {action}
      </div>
      <div className="flex-1 px-4 py-2">{children}</div>
      {footer ? <div className="border-t border-slate-100 px-4 py-2.5">{footer}</div> : null}
    </GlassCard>
  );
}

function EditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
    >
      <Pencil className="h-3 w-3" /> Edit
    </Link>
  );
}

export function StaffProfileOverviewDashboard({ profile }: { profile: StaffMeProfile }) {
  const addr = (profile.addressJson ?? {}) as Record<string, string>;
  const emergency = useQuery({
    queryKey: ['staff-portal', 'emergency'],
    queryFn: fetchMyEmergencyContacts,
  });
  const docs = useQuery({
    queryKey: ['staff-portal', 'documents-compliance'],
    queryFn: fetchMyStaffDocumentCompliance,
  });
  const history = useQuery({
    queryKey: ['staff-portal', 'profile-history'],
    queryFn: fetchMyProfileHistory,
  });

  const primaryEmergency = (emergency.data ?? [])[0];
  const uploadedSlots = (docs.data?.slots ?? []).filter(
    (s) => s.status !== 'MISSING' && s.document,
  );
  const recent = (history.data ?? []).slice(0, 4);

  const currentAddress =
    addr.currentAddress ||
    addr.line1 ||
    [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  const permanentAddress = addr.permanentAddress || addr.line2 || null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <CardShell
        title="Personal Information"
        icon={<UserRound className="h-4 w-4" />}
        iconClass="bg-violet-100 text-violet-600"
        action={<EditLink href="/staff/profile?tab=personal&edit=1" />}
        footer={
          <Link
            href="/staff/profile?tab=personal&edit=1"
            className="text-xs font-medium text-primary hover:underline"
          >
            View More
          </Link>
        }
      >
        <InfoRow label="Full Name" value={profile.fullName} />
        <InfoRow
          label="Date of Birth"
          value={
            profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en-GB') : null
          }
        />
        <InfoRow label="Gender" value={profile.gender} />
        <InfoRow label="Nationality" value={profile.nationality} />
        <InfoRow label="Religion" value={profile.religion} />
        <InfoRow label="Marital Status" value={profile.maritalStatus} />
        <InfoRow label="Blood Group" value={profile.bloodGroup} />
        <InfoRow label="Aadhaar Number" value={maskId(profile.aadhaarNo)} />
        <InfoRow label="PAN Number" value={maskId(profile.panNo)} />
        <InfoRow label="Passport Number" value={maskId(profile.passportNo)} />
      </CardShell>

      <CardShell
        title="Contact Information"
        icon={<Phone className="h-4 w-4" />}
        iconClass="bg-emerald-100 text-emerald-600"
        action={<EditLink href="/staff/profile?tab=contact" />}
        footer={
          <Link
            href="/staff/profile?tab=contact"
            className="text-xs font-medium text-primary hover:underline"
          >
            View More
          </Link>
        }
      >
        <InfoRow
          label="Mobile Number"
          value={profile.mobile}
          badge={
            profile.mobile ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Verified
              </span>
            ) : null
          }
        />
        <InfoRow label="Alternate Number" value={profile.alternateMobile} />
        <InfoRow
          label="Official Email"
          value={profile.email}
          badge={
            profile.email ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Verified
              </span>
            ) : null
          }
        />
        <InfoRow label="Personal Email" value={profile.personalEmail} />
        <InfoRow label="Current Address" value={currentAddress || null} />
        <InfoRow label="Permanent Address" value={permanentAddress} />
      </CardShell>

      <CardShell
        title="Official Information"
        icon={<Building2 className="h-4 w-4" />}
        iconClass="bg-sky-100 text-sky-600"
        action={
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
            View Only
          </span>
        }
        footer={
          <div className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Official information is managed by the institution. Contact HR for any changes.
          </div>
        }
      >
        <InfoRow label="Staff Code" value={profile.employeeCode} />
        <InfoRow label="Department" value={profile.department} />
        <InfoRow label="Designation" value={profile.designation} />
        <InfoRow
          label="Date of Joining"
          value={
            profile.joiningDate
              ? new Date(profile.joiningDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : null
          }
        />
        <InfoRow label="Employment Type" value={staffTypeLabel(profile.staffType)} />
        <InfoRow
          label="Status"
          value={
            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
              {profile.status || '—'}
            </span>
          }
        />
      </CardShell>

      <CardShell
        title="Emergency Contact"
        icon={<Users className="h-4 w-4" />}
        iconClass="bg-rose-100 text-rose-600"
        action={<EditLink href="/staff/profile?tab=emergency" />}
        footer={
          <Link
            href="/staff/profile?tab=emergency"
            className="text-xs font-medium text-primary hover:underline"
          >
            View All Contacts
          </Link>
        }
      >
        {primaryEmergency ? (
          <div className="my-2 rounded-2xl border border-rose-100 bg-rose-50/60 p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500 text-sm font-bold text-white">
                {primaryEmergency.contactName?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {primaryEmergency.contactName}
                    {primaryEmergency.relationship ? ` (${primaryEmergency.relationship})` : ''}
                  </p>
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Primary
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
                  <Phone className="h-3 w-3 text-slate-400" />
                  {primaryEmergency.mobile || '—'}
                </p>
                {primaryEmergency.alternateMobile ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                    <Phone className="h-3 w-3 text-slate-400" />
                    Alt: {primaryEmergency.alternateMobile}
                  </p>
                ) : null}
                {primaryEmergency.address ? (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                    {primaryEmergency.address}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-slate-400">No emergency contact added yet.</p>
        )}
      </CardShell>

      <CardShell
        title="Documents"
        icon={<FileText className="h-4 w-4" />}
        iconClass="bg-orange-100 text-orange-600"
        action={
          <Link
            href="/staff/profile?tab=documents"
            className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
          >
            View All
          </Link>
        }
        footer={
          <Link
            href="/staff/profile?tab=documents"
            className="text-xs font-medium text-primary hover:underline"
          >
            View All Documents
          </Link>
        }
      >
        {uploadedSlots.length ? (
          uploadedSlots.slice(0, 5).map((slot) => (
            <div
              key={slot.code}
              className="flex items-center justify-between gap-2 border-b border-slate-50 py-2 last:border-0"
            >
              <span className="text-xs font-medium text-slate-700">{slot.label}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Uploaded
              </span>
            </div>
          ))
        ) : (
          <p className="py-6 text-center text-xs text-slate-400">No documents uploaded yet.</p>
        )}
      </CardShell>

      <CardShell
        title="Recent Updates"
        icon={<Clock3 className="h-4 w-4" />}
        iconClass="bg-slate-100 text-slate-600"
        action={
          <Link
            href="/staff/profile?tab=activity"
            className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5"
          >
            View All
          </Link>
        }
        footer={
          <Link
            href="/staff/profile?tab=activity"
            className="text-xs font-medium text-primary hover:underline"
          >
            View All Activity
          </Link>
        }
      >
        {recent.length ? (
          <ol className="relative ml-2 space-y-3 border-l border-slate-200 py-2 pl-4">
            {recent.map((row) => (
              <li key={row.id} className="relative">
                <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-sky-400 ring-2 ring-white" />
                <p className="text-xs font-medium text-slate-800">{row.summary}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {row.section} · {new Date(row.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-6 text-center text-xs text-slate-400">No recent profile updates.</p>
        )}
      </CardShell>
    </div>
  );
}

export function StaffProfileTipBanner() {
  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-[18px] border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-emerald-50/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Please keep your profile updated.</p>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-500">
            Updated information helps the institution and ensures smooth communication and official
            processes.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 rounded-xl border-sky-200 text-sky-700"
        onClick={() => {
          window.location.href = '/staff/feedback';
        }}
      >
        Need Help?
      </Button>
    </div>
  );
}
