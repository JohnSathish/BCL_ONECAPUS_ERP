'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerFeeCollectionCenter } from '@/services/fee-collection-centers';
import { apiErrorMessage } from '@/utils/api-error';

const EMPTY = {
  businessName: '',
  ownerName: '',
  gstNumber: '',
  panNumber: '',
  aadhaarNumber: '',
  mobileNumber: '',
  email: '',
  addressLine: '',
  district: '',
  state: '',
  pincode: '',
  username: '',
  password: '',
};

export default function FeeCollectionRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await registerFeeCollectionCenter({
        ...form,
        gstNumber: form.gstNumber || undefined,
        panNumber: form.panNumber || undefined,
        aadhaarNumber: form.aadhaarNumber || undefined,
      });
      const qs = new URLSearchParams({
        centerId: res.centerId,
        ...(res.emailVerifyToken ? { token: res.emailVerifyToken } : {}),
        ...(res.otp ? { otp: res.otp } : {}),
      });
      router.push(`/fee-collection-portal/verify?${qs.toString()}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">Registration</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Authorize your center</h1>
        <p className="mt-2 text-sm text-slate-400">
          Submit business details for college approval. Login stays blocked until approved.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['businessName', 'Business / Net Café name'],
              ['ownerName', 'Owner name'],
              ['mobileNumber', 'Mobile'],
              ['email', 'Email'],
              ['addressLine', 'Address'],
              ['district', 'District'],
              ['state', 'State'],
              ['pincode', 'PIN code'],
              ['gstNumber', 'GST (optional)'],
              ['panNumber', 'PAN (optional)'],
              ['aadhaarNumber', 'Aadhaar (optional)'],
              ['username', 'Login username'],
              ['password', 'Password (min 8)'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className={key === 'addressLine' ? 'sm:col-span-2' : undefined}>
              <Label className="text-slate-300">{label}</Label>
              <Input
                className="mt-1 border-white/15 bg-black/30 text-white"
                type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                value={form[key]}
                required={!label.includes('optional')}
                minLength={key === 'password' ? 8 : undefined}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <div className="flex items-center justify-between gap-3">
          <Link className="text-sm text-sky-300 underline" href="/fee-collection-portal/login">
            Back to login
          </Link>
          <Button type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit registration'}
          </Button>
        </div>
      </form>
    </div>
  );
}
