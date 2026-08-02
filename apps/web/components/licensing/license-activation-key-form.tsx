'use client';

import { useState } from 'react';
import { KeyRound, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { activateLicenseKey } from '@/services/licensing';

const KEY_PATTERN = /^BCLK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

type Props = {
  onActivated?: () => void;
};

function normalizeKeyInput(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function LicenseActivationKeyForm({ onActivated }: Props) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [validateHint, setValidateHint] = useState<string | null>(null);

  function validateFormat(raw: string): { ok: boolean; message: string } {
    const normalized = normalizeKeyInput(raw);
    if (!normalized) {
      return { ok: false, message: 'Enter a license key to validate.' };
    }
    if (!KEY_PATTERN.test(normalized)) {
      return {
        ok: false,
        message: 'Invalid format. Expected BCLK-XXXX-XXXX-XXXX-XXXX.',
      };
    }
    return {
      ok: true,
      message: 'Key format looks valid. Click Activate License to redeem it.',
    };
  }

  function onValidate() {
    const result = validateFormat(key);
    setValidateHint(result.message);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  async function onActivate() {
    const result = validateFormat(key);
    if (!result.ok) {
      setValidateHint(result.message);
      toast.error(result.message);
      return;
    }
    setBusy(true);
    setValidateHint(null);
    try {
      const res = await activateLicenseKey(normalizeKeyInput(key));
      const till = res.license?.expiryDate
        ? new Date(res.license.expiryDate).toLocaleDateString()
        : null;
      toast.success(till ? `License activated until ${till}` : 'License activated successfully');
      setKey('');
      onActivated?.();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Activation failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-white px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Activate License Key</h2>
            <p className="text-sm text-slate-500">
              Enter the activation key provided by BaseCode Labs to renew or activate your ERP
              subscription.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="license-key" className="text-sm font-medium text-slate-700">
              License Key
            </Label>
            <Input
              id="license-key"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setValidateHint(null);
              }}
              placeholder="Enter license key (e.g. BCLK-XXXX-XXXX-XXXX-XXXX)"
              className="h-11 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            {validateHint ? (
              <p
                className={`text-xs ${
                  validateHint.toLowerCase().includes('valid') &&
                  !validateHint.toLowerCase().includes('invalid')
                    ? 'text-emerald-600'
                    : 'text-amber-700'
                }`}
              >
                {validateHint}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void onActivate()}
              disabled={busy || !key.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating…
                </>
              ) : (
                'Activate License'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onValidate}
              disabled={busy || !key.trim()}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              Validate Key
            </Button>
          </div>
        </div>

        <aside className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Where to find your license key?</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-800/80">
                Your license key is shared in the purchase confirmation email from BaseCode Labs, or
                from your account dashboard. Keys look like{' '}
                <span className="font-mono">BCLK-XXXX-XXXX-XXXX-XXXX</span>.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
