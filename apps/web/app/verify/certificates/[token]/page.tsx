import { BadgeCheck, ShieldAlert } from 'lucide-react';

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PublicCertificateVerificationPage({ params }: Props) {
  const { token } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/v1/certificates/verify/${token}`, {
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  const data = payload?.data ?? payload;
  const valid = Boolean(response.ok && data?.valid);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_34%),linear-gradient(135deg,#f8fafc,#ffffff)] px-4 py-10">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl backdrop-blur">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
        >
          {valid ? <BadgeCheck className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
        </div>
        <h1 className="mt-6 text-center text-3xl font-semibold text-slate-950">
          {valid ? 'Certificate Verified' : 'Certificate Not Valid'}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          This public page validates the QR token against the institution certificate registry.
        </p>
        <div className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
          <Info label="Certificate Number" value={data?.certificateNo ?? 'Unavailable'} />
          <Info label="Certificate Type" value={data?.certificateType ?? 'Unavailable'} />
          <Info label="Student Name" value={data?.studentName ?? 'Unavailable'} />
          <Info label="Programme" value={data?.programme ?? 'Unavailable'} />
          <Info
            label="Issue Date"
            value={
              data?.issueDate ? new Date(data.issueDate).toLocaleDateString('en-IN') : 'Unavailable'
            }
          />
          <Info label="Institution" value={data?.institution ?? 'Unavailable'} />
          <Info label="Status" value={data?.status ?? 'INVALID'} />
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}
