'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { IndianRupee, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateCycle } from '@/services/admissions';
import { apiErrorMessage } from '@/utils/api-error';

export type AdmissionCycleSettings = {
  applicationNumberPrefix?: string;
  applicationFee?: number;
  admissionFeeMin?: number;
  requirePaymentBeforeSubmit?: boolean;
  helpDesk?: { phone?: string; email?: string };
};

type CycleLike = {
  id: string;
  title?: string;
  status: string;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  applicationDeadline?: string | null;
  paymentDeadline?: string | null;
  settings?: Record<string, unknown> | null;
};

type Props = {
  cycle: CycleLike;
  onUpdated?: () => void;
  compact?: boolean;
};

function toLocalInput(value?: string | null) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

function parseSettings(raw?: Record<string, unknown> | null): AdmissionCycleSettings {
  const s = (raw ?? {}) as AdmissionCycleSettings;
  return {
    applicationNumberPrefix: s.applicationNumberPrefix ?? 'DBCT26',
    applicationFee: s.applicationFee ?? 600,
    admissionFeeMin: s.admissionFeeMin ?? 10500,
    requirePaymentBeforeSubmit: s.requirePaymentBeforeSubmit !== false,
    helpDesk: {
      phone: s.helpDesk?.phone ?? '',
      email: s.helpDesk?.email ?? '',
    },
  };
}

export function AdmissionsCycleSettingsPanel({ cycle, onUpdated, compact }: Props) {
  const readOnly = cycle.status === 'ARCHIVED';
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState(cycle.title ?? '');
  const [registrationOpensAt, setRegistrationOpensAt] = useState(
    toLocalInput(cycle.registrationOpensAt),
  );
  const [registrationClosesAt, setRegistrationClosesAt] = useState(
    toLocalInput(cycle.registrationClosesAt),
  );
  const [applicationDeadline, setApplicationDeadline] = useState(
    toLocalInput(cycle.applicationDeadline),
  );
  const [paymentDeadline, setPaymentDeadline] = useState(toLocalInput(cycle.paymentDeadline));

  const [settings, setSettings] = useState(() => parseSettings(cycle.settings));

  useEffect(() => {
    setTitle(cycle.title ?? '');
    setRegistrationOpensAt(toLocalInput(cycle.registrationOpensAt));
    setRegistrationClosesAt(toLocalInput(cycle.registrationClosesAt));
    setApplicationDeadline(toLocalInput(cycle.applicationDeadline));
    setPaymentDeadline(toLocalInput(cycle.paymentDeadline));
    setSettings(parseSettings(cycle.settings));
  }, [
    cycle.id,
    cycle.settings,
    cycle.title,
    cycle.registrationOpensAt,
    cycle.registrationClosesAt,
    cycle.applicationDeadline,
    cycle.paymentDeadline,
  ]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCycle(cycle.id, {
        title: title.trim() || undefined,
        registrationOpensAt: registrationOpensAt
          ? new Date(registrationOpensAt).toISOString()
          : undefined,
        registrationClosesAt: registrationClosesAt
          ? new Date(registrationClosesAt).toISOString()
          : undefined,
        applicationDeadline: applicationDeadline
          ? new Date(applicationDeadline).toISOString()
          : undefined,
        paymentDeadline: paymentDeadline ? new Date(paymentDeadline).toISOString() : undefined,
        settings: {
          applicationNumberPrefix: settings.applicationNumberPrefix?.trim() || 'DBCT26',
          applicationFee: Number(settings.applicationFee) || 600,
          admissionFeeMin: Number(settings.admissionFeeMin) || 10500,
          requirePaymentBeforeSubmit: settings.requirePaymentBeforeSubmit !== false,
          helpDesk: {
            phone: settings.helpDesk?.phone?.trim() || undefined,
            email: settings.helpDesk?.email?.trim() || undefined,
          },
        },
      }),
    onSuccess: () => {
      setError(null);
      setMessage('Cycle settings saved.');
      onUpdated?.();
    },
    onError: (err) => {
      setMessage(null);
      setError(apiErrorMessage(err, 'Failed to save cycle settings'));
    },
  });

  return (
    <div className={compact ? 'space-y-4' : 'grid gap-6 lg:grid-cols-2'}>
      {error ? <p className="text-sm text-destructive lg:col-span-2">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600 lg:col-span-2">{message}</p> : null}

      <Card className={compact ? 'border-0 shadow-none' : undefined}>
        <CardHeader>
          <CardTitle>Deadlines & portal</CardTitle>
          <CardDescription>
            Registration, application, and payment cut-off dates shown to applicants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Cycle title</Label>
            <Input
              className="mt-1"
              value={title}
              disabled={readOnly}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {[
            [
              'registrationOpensAt',
              'Registration opens',
              registrationOpensAt,
              setRegistrationOpensAt,
            ],
            [
              'registrationClosesAt',
              'Registration closes',
              registrationClosesAt,
              setRegistrationClosesAt,
            ],
            [
              'applicationDeadline',
              'Application deadline',
              applicationDeadline,
              setApplicationDeadline,
            ],
            ['paymentDeadline', 'Payment deadline', paymentDeadline, setPaymentDeadline],
          ].map(([key, label, value, setter]) => (
            <div key={key as string}>
              <Label>{label as string}</Label>
              <Input
                type="datetime-local"
                className="mt-1"
                disabled={readOnly}
                value={value as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              />
            </div>
          ))}
          <div>
            <Label>Application number prefix</Label>
            <Input
              className="mt-1 font-mono"
              disabled={readOnly}
              value={settings.applicationNumberPrefix ?? ''}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, applicationNumberPrefix: e.target.value }))
              }
              placeholder="DBCT26"
            />
          </div>
        </CardContent>
      </Card>

      <Card className={compact ? 'border-0 shadow-none' : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Fees & help desk
          </CardTitle>
          <CardDescription>
            Application fee for Razorpay/office collection and applicant portal copy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Application fee (₹)</Label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                disabled={readOnly}
                value={settings.applicationFee ?? 600}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, applicationFee: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <Label>Min. admission fee (₹)</Label>
              <Input
                type="number"
                min={0}
                className="mt-1"
                disabled={readOnly}
                value={settings.admissionFeeMin ?? 10500}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, admissionFeeMin: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              disabled={readOnly}
              checked={settings.requirePaymentBeforeSubmit !== false}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  requirePaymentBeforeSubmit: e.target.checked,
                }))
              }
            />
            <span>
              <strong>Require fee before submit</strong>
              <span className="mt-0.5 block text-muted-foreground">
                Applicants cannot submit until fee is marked paid or paid online.
              </span>
            </span>
          </label>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Phone className="h-4 w-4" />
              Help desk (portal)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  className="mt-1"
                  disabled={readOnly}
                  value={settings.helpDesk?.phone ?? ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      helpDesk: { ...prev.helpDesk, phone: e.target.value },
                    }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  className="mt-1"
                  disabled={readOnly}
                  value={settings.helpDesk?.email ?? ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      helpDesk: { ...prev.helpDesk, email: e.target.value },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!readOnly ? (
        <div className={compact ? '' : 'lg:col-span-2'}>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save cycle settings'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
