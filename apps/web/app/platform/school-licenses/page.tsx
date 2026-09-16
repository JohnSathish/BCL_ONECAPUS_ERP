'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlatformShell } from '@/components/platform/platform-shell';
import { apiErrorMessage } from '@/utils/api-error';
import {
  bclSchoolLicenseAction,
  fetchBclSchoolLicenses,
  issueBclSchoolLicense,
} from '@/services/school-license';

export default function SchoolSaasLicensesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['bcl-school-licenses'], queryFn: fetchBclSchoolLicenses });
  const [form, setForm] = useState({
    institutionName: "St. Luke's Secondary School",
    institutionCode: 'st-lukes-tura',
    licenseType: 'ANNUAL',
    termDays: 365,
    maxStudents: 2000,
    maxStaff: 250,
  });
  const [issued, setIssued] = useState<string | null>(null);
  const issue = useMutation({
    mutationFn: () => issueBclSchoolLicense(form),
    onSuccess: (res) => {
      setIssued(`Key: ${res.licenseKey}\nToken:\n${res.signedToken ?? ''}`);
      void qc.invalidateQueries({ queryKey: ['bcl-school-licenses'] });
    },
  });

  return (
    <PlatformShell title="School ERP licenses">
      <p className="mb-4 text-sm text-muted-foreground">
        Issue Ed25519-signed annual licenses for school ERP installations. The private signing key
        stays on the API host (LICENSE_PRIVATE_KEY) and is never sent to the browser.
      </p>
      <div className="mb-6 grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
        <input
          className="h-10 rounded-md border px-3 text-sm"
          value={form.institutionName}
          onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
        />
        <input
          className="h-10 rounded-md border px-3 text-sm"
          value={form.institutionCode}
          onChange={(e) => setForm({ ...form, institutionCode: e.target.value })}
        />
        <button
          type="button"
          className="h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          onClick={() => issue.mutate()}
        >
          Generate license key
        </button>
      </div>
      {issue.isError ? (
        <p className="mb-3 text-sm text-destructive">{apiErrorMessage(issue.error)}</p>
      ) : null}
      {issued ? (
        <pre className="mb-6 max-h-48 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
          {issued}
        </pre>
      ) : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">License</th>
              <th className="px-3 py-2">Institution</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Valid until</th>
              <th className="px-3 py-2">Students</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <tr key={String(row.id)} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{String(row.licenseKey)}</td>
                <td className="px-3 py-2">{String(row.institutionName)}</td>
                <td className="px-3 py-2">{String(row.licenseType)}</td>
                <td className="px-3 py-2">{String(row.status)}</td>
                <td className="px-3 py-2">
                  {row.expiresAt ? new Date(String(row.expiresAt)).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2">{String(row.maxStudents)}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() =>
                      bclSchoolLicenseAction(String(row.id), 'renew', { days: 365 }).then(() =>
                        qc.invalidateQueries({ queryKey: ['bcl-school-licenses'] }),
                      )
                    }
                  >
                    Renew
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PlatformShell>
  );
}
