'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { verifyAppointmentOrder } from '@/services/hr-appointment';

type VerifyResult = {
  valid: boolean;
  orderNo?: string;
  candidateName?: string;
  status?: string;
  verifyCode?: string;
  generatedAt?: string;
};

export default function AppointmentOrderVerifyPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    verifyAppointmentOrder(token)
      .then(setResult)
      .catch(() => setResult({ valid: false }))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Appointment Order Verification</h1>
          <p className="text-xs text-slate-500">Official appointment letter authenticity check</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Verifying…
          </div>
        ) : result?.valid ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 px-4 py-6 text-emerald-800">
              <ShieldCheck className="h-10 w-10" />
              <p className="text-sm font-semibold">Authentic Appointment Order</p>
              <p className="text-xs">{result.status}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Order No</dt>
                <dd className="font-mono font-semibold">{result.orderNo}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Candidate</dt>
                <dd className="font-medium">{result.candidateName}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Verification ID</dt>
                <dd className="font-mono">{result.verifyCode}</dd>
              </div>
            </dl>
            {result.generatedAt ? (
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <CheckCircle2 className="h-3 w-3" />
                Generated {new Date(result.generatedAt).toLocaleString('en-IN')}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-rose-50 px-4 py-8 text-rose-800">
            <ShieldAlert className="h-10 w-10" />
            <p className="text-sm font-semibold">Verification Failed</p>
            <p className="text-xs text-center">Invalid or expired verification token.</p>
          </div>
        )}
      </div>
    </div>
  );
}
