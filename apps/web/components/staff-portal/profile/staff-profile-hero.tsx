'use client';

import { useRef, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Camera,
  Check,
  Copy,
  Droplets,
  Heart,
  Mail,
  Phone,
  UserRound,
} from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { staffTypeLabel } from '@/components/staff-module/directory/staff-filter-utils';
import { resolveUploadAvatarUrl } from '@/lib/branding-asset';
import { uploadMyPhoto } from '@/services/staff';
import type { StaffMeProfile } from '@/types/staff-portal';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function CompletionRing({ pct }: { pct: number }) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#f87171';

  return (
    <div className="relative mx-auto h-24 w-24">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-slate-900">{pct}%</span>
        <span className="text-[10px] font-medium text-slate-400">Complete</span>
      </div>
    </div>
  );
}

export function StaffProfileHero({
  profile,
  onPhotoSaved,
  onViewCompletion,
}: {
  profile: StaffMeProfile;
  onPhotoSaved: (photoUrl?: string) => void;
  onViewCompletion: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pct = profile.profileCompletion ?? 0;
  const effectivePhoto = localPhotoUrl || profile.photoUrl;
  const photoSrc = effectivePhoto ? resolveUploadAvatarUrl(effectivePhoto) : null;
  const status = (profile.status ?? '').toUpperCase();

  async function onCopyCode() {
    try {
      await navigator.clipboard.writeText(profile.employeeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  async function handlePhoto(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await uploadMyPhoto(file);
      setLocalPhotoUrl(res.photoUrl);
      onPhotoSaved(res.photoUrl);
    } catch (e) {
      setUploadError(apiErrorMessage(e, 'Photo upload failed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <GlassCard className="overflow-hidden rounded-[18px] border-slate-200/80 p-0 shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.7fr)_minmax(240px,0.9fr)]">
        {/* Identity */}
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center lg:border-b-0 lg:border-r">
          <div className="relative mx-auto shrink-0 sm:mx-0">
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photoSrc}
                src={photoSrc}
                alt=""
                className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary ring-4 ring-slate-100">
                {profile.fullName?.charAt(0) ?? '?'}
              </div>
            )}
            <button
              type="button"
              aria-label="Change photo"
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md ring-2 ring-white hover:bg-primary/90 disabled:opacity-60"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void handlePhoto(f);
              }}
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
              {profile.fullName}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {profile.designation ?? '—'}
              {profile.department ? ` – ${profile.department}` : ''}
            </p>
            {uploading ? <p className="mt-1 text-xs text-slate-500">Uploading photo…</p> : null}
            {uploadError ? <p className="mt-1 text-xs text-destructive">{uploadError}</p> : null}
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={() => void onCopyCode()}
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-100"
              >
                Staff Code: {profile.employeeCode}
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
              <span
                className={cn(
                  'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase',
                  status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600',
                )}
              >
                {status || '—'}
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-slate-500">
              {profile.email ? (
                <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{profile.email}</span>
                </p>
              ) : null}
              {profile.mobile ? (
                <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  {profile.mobile}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Completion */}
        <div className="flex flex-col items-center justify-center gap-3 border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Profile Completion
          </p>
          <CompletionRing pct={pct} />
          <p className="max-w-[200px] text-center text-xs leading-relaxed text-slate-500">
            {pct >= 80
              ? 'Great going! Complete your profile to help us know you better.'
              : 'Keep going — a complete profile helps the institution serve you better.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-primary/30 text-primary"
            onClick={onViewCompletion}
          >
            View Completion
          </Button>
        </div>

        {/* Quick info */}
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-1">
          <QuickRow
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Department"
            value={profile.department}
          />
          <QuickRow
            icon={<CalendarDays className="h-3.5 w-3.5" />}
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
          <QuickRow
            icon={<UserRound className="h-3.5 w-3.5" />}
            label="Employee Type"
            value={staffTypeLabel(profile.staffType)}
          />
          <QuickRow
            icon={<Droplets className="h-3.5 w-3.5" />}
            label="Blood Group"
            value={profile.bloodGroup}
          />
          <QuickRow
            icon={<Heart className="h-3.5 w-3.5" />}
            label="Marital Status"
            value={profile.maritalStatus}
          />
        </div>
      </div>
    </GlassCard>
  );
}

function QuickRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 ring-1 ring-slate-100">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-800">{value || '—'}</p>
      </div>
    </div>
  );
}
