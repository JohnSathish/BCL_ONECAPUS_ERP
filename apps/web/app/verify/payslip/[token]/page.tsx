'use client';

import { use, useEffect, useState } from 'react';
import { api } from '@/services/api';

export default function VerifyPayslipPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/v1/verify/payslip/${token}`)
      .then((res) => setResult(res.data.data ?? res.data))
      .catch(() => setResult({ valid: false }))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading)
    return <div className="flex min-h-screen items-center justify-center">Verifying payslip…</div>;

  if (!result?.valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6">
        <h1 className="text-xl font-semibold text-red-600">Invalid or unpublished payslip</h1>
        <p className="text-sm text-muted-foreground">
          This verification code could not be matched to a published payslip.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <div className="rounded-xl border bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-emerald-600">Payslip Verified</h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Employee</dt>
            <dd>{String(result.employee)}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Code</dt>
            <dd>{String(result.employeeCode)}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Department</dt>
            <dd>{String(result.department ?? '—')}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Period</dt>
            <dd>
              {String(result.month)}/{String(result.year)}
            </dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Net Salary</dt>
            <dd className="font-semibold">₹{Number(result.netSalary).toLocaleString('en-IN')}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
