import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, BadgeCheck, ShieldAlert, ShieldCheck } from 'lucide-react';

type Props = {
  params: Promise<{ token: string }>;
};

type PublicAchievement = {
  studentName: string;
  activityTitle: string;
  activityTypeLabel: string;
  achievementLabel: string;
  departmentName?: string | null;
  eventDate: string;
  collegeName?: string | null;
  certificateNo?: string | null;
  issuedAt?: string | null;
  revoked: boolean;
  verifyUrl?: string | null;
  hasIntegritySeal?: boolean;
};

const API_BASE =
  process.env.API_INTERNAL_URL ??
  (process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api`
    : 'http://127.0.0.1:3001/api');

async function fetchAchievement(token: string): Promise<PublicAchievement | null> {
  try {
    const response = await fetch(`${API_BASE}/v1/department-activities/achievements/${token}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return (payload?.data ?? payload) as PublicAchievement;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchAchievement(token);
  if (!data) {
    return { title: 'Achievement not found' };
  }
  const title = `${data.studentName} — ${data.achievementLabel} | ${data.activityTitle}`;
  const description = `${data.achievementLabel} in ${data.activityTitle} (${data.activityTypeLabel})${
    data.collegeName ? ` at ${data.collegeName}` : ''
  }.`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${appUrl}/share/achievements/${token}`,
      images: [{ url: `${appUrl}/share/achievements/${token}/opengraph-image` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function PublicAchievementSharePage({ params }: Props) {
  const { token } = await params;
  const data = await fetchAchievement(token);
  const valid = Boolean(data && !data.revoked);

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">Achievement not found</h1>
          <p className="mt-2 text-sm text-slate-600">This share link is invalid or has expired.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7,transparent_40%),linear-gradient(160deg,#fff7ed,#ffffff)] px-4 py-10">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-amber-200/80 bg-white/95 shadow-xl backdrop-blur">
        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
            {data.collegeName ?? 'Institution achievement'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{data.studentName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.achievementLabel} · {data.activityTypeLabel}
          </p>
        </div>

        <div className="space-y-5 px-8 py-7">
          <div className="flex items-start gap-3">
            <div
              className={`mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {valid ? <BadgeCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{data.activityTitle}</p>
              <p className="mt-1 text-sm text-slate-600">
                {data.departmentName ? `${data.departmentName} · ` : ''}
                {new Date(data.eventDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm sm:grid-cols-2">
            <Info label="Achievement" value={data.achievementLabel} />
            <Info label="Certificate No." value={data.certificateNo ?? '—'} />
            <Info
              label="Issued"
              value={data.issuedAt ? new Date(data.issuedAt).toLocaleDateString('en-IN') : '—'}
            />
            <Info label="Status" value={data.revoked ? 'REVOKED' : 'VALID'} />
          </div>

          {data.hasIntegritySeal ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Certificate integrity seal present
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {data.verifyUrl ? (
              <Link
                href={data.verifyUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white"
              >
                <Award className="h-4 w-4" />
                Verify certificate
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
