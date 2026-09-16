'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import {
  fetchSchoolReportAudit,
  fetchSchoolReportDesign,
  saveSchoolReportDesign,
} from '@/services/school-reports';
import { PrimaryButton } from '../academic/academic-ui';
import { WaCard } from '../whatsapp/whatsapp-ui';

export function ReportDesignDesk() {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const design = useQuery({
    queryKey: ['school-report-design'],
    queryFn: fetchSchoolReportDesign,
    enabled: ready,
  });
  const audit = useQuery({
    queryKey: ['school-report-audit'],
    queryFn: fetchSchoolReportAudit,
    enabled: ready,
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const settings = { ...(design.data?.settings as Record<string, string>), ...form };
  const save = useMutation({
    mutationFn: () => saveSchoolReportDesign(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-report-design'] }),
  });
  const field = (key: string, label: string) => (
    <label key={key} className="block text-sm">
      {label}
      <input
        className="mt-1 w-full rounded border px-2 py-1"
        value={String(settings[key] ?? '')}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Report design</h1>
        <p className="text-sm text-slate-500">
          School branding applied to every PDF, Excel and print export.
        </p>
      </div>
      {design.error ? (
        <p className="text-sm text-rose-700">{apiErrorMessage(design.error)}</p>
      ) : null}
      <WaCard className="grid gap-3 p-4 md:grid-cols-2">
        {field('schoolName', 'School name')}
        {field('shortName', 'Short name')}
        {field('addressLine', 'Address')}
        {field('city', 'City')}
        {field('district', 'District')}
        {field('state', 'State')}
        {field('pin', 'PIN')}
        {field('phone', 'Phone')}
        {field('email', 'Email')}
        {field('website', 'Website')}
        {field('primaryColor', 'Primary colour')}
        {field('watermark', 'Optional watermark text')}
        {field('timezone', 'Timezone')}
        {field('footerText', 'Footer text')}
        {field('principalName', 'Principal')}
        {field('signatoryName', 'Authorized signatory')}
        <div className="md:col-span-2">
          <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save report design'}
          </PrimaryButton>
        </div>
      </WaCard>
      <WaCard className="p-4">
        <h2 className="mb-2 font-semibold">Export audit</h2>
        {(audit.data ?? []).slice(0, 30).map((row) => (
          <div key={String(row.id)} className="flex justify-between border-b py-1 text-sm">
            <span>
              {String(row.title)} · {String(row.format)} · {String(row.recordCount)} rows
            </span>
            <span className="text-slate-500">
              {new Date(String(row.createdAt)).toLocaleString()}
            </span>
          </div>
        ))}
      </WaCard>
    </div>
  );
}
