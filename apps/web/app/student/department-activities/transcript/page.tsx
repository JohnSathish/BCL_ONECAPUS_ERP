'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  StcEmptyState,
  StcHero,
  StcPanel,
  StcStatusBadge,
} from '@/components/short-term-courses/stc-shared';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  createAchievementShare,
  fetchActivityTypes,
  fetchMyTranscript,
  type TranscriptEntry,
} from '@/services/department-activities';
import { apiErrorMessage } from '@/utils/api-error';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function TranscriptRow({
  entry,
  onShared,
}: {
  entry: TranscriptEntry;
  onShared: (msg: { tone: 'ok' | 'err'; text: string }) => void;
}) {
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);

  const share = async (certificateLinkId: string) => {
    setBusyLinkId(certificateLinkId);
    try {
      const result = await createAchievementShare(certificateLinkId);
      try {
        await navigator.clipboard.writeText(result.shareUrl);
      } catch {
        /* clipboard may be blocked */
      }
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        try {
          await navigator.share({
            title: entry.activity.title,
            text: `${entry.activity.title} — ${entry.result?.positionLabel ?? 'Participation'}`,
            url: result.shareUrl,
          });
        } catch {
          /* user cancelled share sheet */
        }
      }
      onShared({
        tone: 'ok',
        text: `Share link copied: ${result.shareUrl}`,
      });
    } catch (e) {
      onShared({
        tone: 'err',
        text: apiErrorMessage(e, 'Unable to create share link'),
      });
    } finally {
      setBusyLinkId(null);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{entry.activity.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {entry.activity.activityTypeLabel}
            {entry.activity.department?.name ? ` · ${entry.activity.department.name}` : ''}
            {' · '}
            {formatDate(entry.activity.eventDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StcStatusBadge status={entry.registrationStatus} />
          {entry.attended ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Attended
            </span>
          ) : null}
          {entry.result ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <Award className="h-3.5 w-3.5" />
              {entry.result.positionLabel}
            </span>
          ) : null}
        </div>
      </div>

      {entry.presentation ? (
        <p className="mt-3 text-sm text-slate-600">
          Presentation: {entry.presentation.topicTitle} ({entry.presentation.status})
        </p>
      ) : null}

      {entry.certificates.length > 0 ? (
        <div className="mt-4 space-y-2">
          {entry.certificates.map((cert) => (
            <div
              key={cert.certificateLinkId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div className="text-sm">
                <p className="font-medium text-slate-800">
                  {cert.certificateType === 'PARTICIPATION'
                    ? 'Participation certificate'
                    : cert.certificateType.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-slate-500">
                  {cert.certificateNo ?? '—'}
                  {cert.hasIntegritySeal ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-700">
                      <ShieldCheck className="h-3 w-3" />
                      Sealed
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {cert.verifyUrl ? (
                  <Button size="sm" variant="outline" type="button" asChild>
                    <a href={cert.verifyUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Verify
                    </a>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  type="button"
                  disabled={busyLinkId === cert.certificateLinkId}
                  onClick={() => void share(cert.certificateLinkId)}
                >
                  {busyLinkId === cert.certificateLinkId ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Share2 className="mr-1 h-3.5 w-3.5" />
                  )}
                  Share
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">No certificate linked yet.</p>
      )}
    </article>
  );
}

export default function StudentActivityTranscriptPage() {
  const session = useRequireAuth();
  const [activityType, setActivityType] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [certificateOnly, setCertificateOnly] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const typesQ = useQuery({
    queryKey: ['dept-activities', 'types'],
    queryFn: fetchActivityTypes,
    enabled: Boolean(session),
  });

  const transcriptQ = useQuery({
    queryKey: ['dept-activities', 'transcript', activityType, academicYear, certificateOnly],
    queryFn: () =>
      fetchMyTranscript({
        activityType: activityType || undefined,
        academicYear: academicYear || undefined,
        hasCertificate: certificateOnly ? true : undefined,
      }),
    enabled: Boolean(session),
  });

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(current - i));
  }, []);

  if (!session) return null;

  const transcript = transcriptQ.data;
  const entries = transcript?.entries ?? [];

  return (
    <DashboardShell role="student" title="Activity transcript">
      <div className="space-y-6">
        <StcHero
          badge="Student record"
          title="Activity transcript"
          subtitle="Your seminars, workshops, competitions, NSS and club participation with linked certificates."
          actions={
            <Button variant="outline" type="button" asChild>
              <Link href="/student/department-activities">Back to activities</Link>
            </Button>
          }
        />

        {message ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-start gap-2">
              <Copy className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-all">{message.text}</span>
            </div>
          </div>
        ) : null}

        <StcPanel title="Filters" description="Narrow by type, year, or certificates">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="activityType">Activity type</Label>
              <select
                id="activityType"
                className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
              >
                <option value="">All types</option>
                {(typesQ.data ?? []).map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="academicYear">Year</Label>
              <select
                id="academicYear"
                className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                <option value="">All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={certificateOnly}
                  onChange={(e) => setCertificateOnly(e.target.checked)}
                />
                Certificate only
              </label>
            </div>
          </div>
        </StcPanel>

        {transcript ? (
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Activities', transcript.summary.total],
              ['Attended', transcript.summary.attended],
              ['Certificates', transcript.summary.withCertificates],
              ['Awards', transcript.summary.awards],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"
              >
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        ) : null}

        <StcPanel
          title="Transcript"
          description={
            transcript?.student.name
              ? `${transcript.student.name}${
                  transcript.student.enrollmentNumber
                    ? ` · ${transcript.student.enrollmentNumber}`
                    : ''
                }`
              : 'Participation record'
          }
          icon={Award}
        >
          {transcriptQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading transcript…
            </div>
          ) : entries.length === 0 ? (
            <StcEmptyState
              icon={Award}
              title="No activities yet"
              description="Register for department activities to build your transcript."
            />
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <TranscriptRow key={entry.registrationId} entry={entry} onShared={setMessage} />
              ))}
            </div>
          )}
        </StcPanel>
      </div>
    </DashboardShell>
  );
}
