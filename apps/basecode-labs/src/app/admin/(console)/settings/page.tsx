import { smtpReady } from '@/lib/mail';
import { COMPANY } from '@/lib/company';

export default function SettingsPage() {
  const rows = [
    ['App URL', process.env.APP_URL ?? 'http://localhost:1610'],
    ['Environment', process.env.NODE_ENV],
    ['Admin mailbox', process.env.ADMIN_EMAIL ?? COMPANY.email],
    [
      'SMTP',
      smtpReady()
        ? 'Configured — login codes are emailed'
        : 'Not configured — development codes may print locally',
    ],
    [
      'License signing',
      process.env.LICENSE_SIGNING_SECRET ? 'Secret is set' : 'Using development fallback',
    ],
  ];
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        Runtime status for this BaseCode Central instance. Secrets are never shown.
      </p>
      <dl className="mt-6 divide-y divide-slate-100 rounded-[22px] border border-white bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm font-semibold text-slate-500">{k}</dt>
            <dd className="text-sm text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
