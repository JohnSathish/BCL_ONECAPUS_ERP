'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { fetchCareersVerify, type CareersVerifyResult } from '@/services/careers-portal';

export default function CareersVerifyPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [result, setResult] = useState<CareersVerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetchCareersVerify(token)
      .then(setResult)
      .catch(() => setResult({ valid: false }))
      .finally(() => setLoading(false));
  }, [token]);

  const valid = Boolean(result?.valid);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_34%),linear-gradient(180deg,#0b1f4a_0%,#123058_28%,#f8fafc_28%)] px-4 py-12">
      <section className="mx-auto max-w-lg rounded-2xl border border-cyan-400/20 bg-white p-6 shadow-[0_24px_80px_rgba(8,24,48,0.25)]">
        <div className="mb-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Careers Portal
          </p>
          <h1 className="mt-1 text-lg font-semibold text-[#0b1f4a]">Application Verification</h1>
          <p className="mt-1 text-xs text-slate-500">
            Authenticity check for submitted job applications
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Verifying…
          </div>
        ) : valid ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 px-4 py-6 text-emerald-800">
              <ShieldCheck className="h-10 w-10" />
              <p className="text-sm font-semibold">Valid Application Record</p>
            </div>
            <dl className="space-y-3 text-sm">
              <Info label="Application No" value={result?.applicationNo ?? '—'} mono />
              <Info label="Name" value={result?.candidateName ?? '—'} />
              <Info label="Position" value={result?.position ?? '—'} />
              <Info
                label="Applied At"
                value={result?.appliedAt ? new Date(result.appliedAt).toLocaleString('en-IN') : '—'}
              />
              <Info label="Content Hash" value={result?.contentHash ?? '—'} mono />
            </dl>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-red-50 px-4 py-10 text-red-800">
            <ShieldAlert className="h-10 w-10" />
            <p className="text-sm font-semibold">Verification Failed</p>
            <p className="text-xs text-red-700">
              This token is invalid or the application record was not found.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-right font-medium text-slate-900 break-all ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
