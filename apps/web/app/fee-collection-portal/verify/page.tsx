'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyCenterEmail, verifyCenterOtp } from '@/services/fee-collection-centers';
import { apiErrorMessage } from '@/utils/api-error';

function VerifyForm() {
  const params = useSearchParams();
  const [centerId, setCenterId] = useState(params.get('centerId') ?? '');
  const [token, setToken] = useState(params.get('token') ?? '');
  const [otp, setOtp] = useState(params.get('otp') ?? '');
  const [emailOk, setEmailOk] = useState(false);
  const [otpOk, setOtpOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verifyEmail() {
    setBusy(true);
    setError(null);
    try {
      await verifyCenterEmail(centerId, token);
      setEmailOk(true);
      setMsg('Email verified.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setError(null);
    try {
      await verifyCenterOtp(centerId, otp);
      setOtpOk(true);
      setMsg('Mobile OTP verified. Wait for college approval before login.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">Verification</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Confirm email & OTP</h1>
        <p className="mt-2 text-sm text-slate-400">
          Complete both checks. College staff must still approve your center before login works.
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div>
          <Label className="text-slate-300">Center ID</Label>
          <Input
            className="mt-1 border-white/15 bg-black/30 text-white"
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-slate-300">Email token</Label>
          <Input
            className="mt-1 border-white/15 bg-black/30 text-white"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <Button
            className="mt-2"
            type="button"
            disabled={busy || !centerId || !token}
            onClick={verifyEmail}
          >
            {emailOk ? 'Email verified' : 'Verify email'}
          </Button>
        </div>
        <div>
          <Label className="text-slate-300">OTP</Label>
          <Input
            className="mt-1 border-white/15 bg-black/30 text-white"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <Button
            className="mt-2"
            type="button"
            disabled={busy || !centerId || !otp}
            onClick={verifyOtp}
          >
            {otpOk ? 'OTP verified' : 'Verify OTP'}
          </Button>
        </div>
        {msg ? <p className="text-sm text-emerald-300">{msg}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <Link
          className="inline-block text-sm text-sky-300 underline"
          href="/fee-collection-portal/login"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}

export default function FeeCollectionVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
          Loading…
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
