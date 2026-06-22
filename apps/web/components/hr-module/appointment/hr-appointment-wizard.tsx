'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPayStructures } from '@/services/payroll';
import {
  createAppointmentOrder,
  fetchAppointmentCandidates,
  fetchAppointmentCandidate,
  fetchAppointmentTemplates,
  generateAppointmentOrder,
  previewAppointmentSalary,
  seedAppointmentTemplates,
} from '@/services/hr-appointment';
import { apiErrorMessage } from '@/utils/api-error';

const STEPS = ['Candidate', 'Employment', 'Salary', 'Terms & Generate'];

export function HrAppointmentWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enabled = useAuthQueryEnabled();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [candidate, setCandidate] = useState<Record<string, unknown> | null>(null);
  const [employment, setEmployment] = useState({
    appointmentType: 'PROBATIONARY',
    employmentMode: 'FULL_TIME',
    staffType: 'TEACHING',
    designationId: '',
    departmentId: '',
    shiftId: '',
    joiningDate: '',
    reportingTo: '',
  });
  const [salary, setSalary] = useState({
    payStructureTemplateId: '',
    basicPay: '',
    grossSalary: 0,
    totalDeductions: 0,
    netSalary: 0,
    lines: [] as Array<{ name: string; amount: number; componentType: string }>,
  });
  const [termsHtml, setTermsHtml] = useState('');
  const [templateId, setTemplateId] = useState('');

  const candidatesQ = useQuery({
    queryKey: ['hr', 'appointment-candidates', search],
    queryFn: () => fetchAppointmentCandidates(search),
    enabled,
  });
  const structuresQ = useQuery({
    queryKey: ['pay-structures'],
    queryFn: () => fetchPayStructures(),
    enabled,
  });
  const templatesQ = useQuery({
    queryKey: ['hr', 'appointment-templates'],
    queryFn: fetchAppointmentTemplates,
    enabled,
  });

  const selectCandidateMut = useMutation({
    mutationFn: (id: string) => fetchAppointmentCandidate(id),
    onSuccess: (data) => {
      setApplicationId(String(data.id));
      setCandidate(data as Record<string, unknown>);
      const vac = data.vacancy as Record<string, unknown> | undefined;
      setEmployment((e) => ({
        ...e,
        staffType: String(vac?.staffType ?? e.staffType),
        designationId: String((vac?.designation as { id?: string })?.id ?? e.designationId),
        departmentId: String((vac?.department as { id?: string })?.id ?? e.departmentId),
      }));
      setStep(1);
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not load candidate')),
  });

  const initialApplicationId = searchParams.get('applicationId');
  useEffect(() => {
    if (!initialApplicationId || applicationId || selectCandidateMut.isPending) return;
    selectCandidateMut.mutate(initialApplicationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once from URL
  }, [initialApplicationId]);

  const previewMut = useMutation({
    mutationFn: () =>
      previewAppointmentSalary({
        payStructureTemplateId: salary.payStructureTemplateId,
        basicPay: Number(salary.basicPay),
      }),
    onSuccess: (data) => {
      setSalary((s) => ({
        ...s,
        lines: data.lines,
        grossSalary: data.grossSalary,
        totalDeductions: data.totalDeductions,
        netSalary: data.netSalary,
      }));
      setMessage('Salary preview updated.');
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Salary preview failed')),
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const order = await createAppointmentOrder({
        applicationId,
        ...employment,
        payStructureTemplateId: salary.payStructureTemplateId || undefined,
        basicPay: salary.basicPay ? Number(salary.basicPay) : undefined,
        salaryBreakup: salary.lines,
        grossSalary: salary.grossSalary,
        totalDeductions: salary.totalDeductions,
        netSalary: salary.netSalary,
        templateId: templateId || undefined,
        termsHtml: termsHtml || undefined,
      });
      return generateAppointmentOrder(order.id);
    },
    onSuccess: (order) => {
      router.push(`/admin/hr/appointment-orders/${order.id}`);
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not generate order')),
  });

  const seedMut = useMutation({
    mutationFn: seedAppointmentTemplates,
    onSuccess: () => templatesQ.refetch(),
  });

  const candidates = candidatesQ.data ?? [];
  const structures = structuresQ.data ?? [];
  const templates = templatesQ.data ?? [];

  const previewHtml = useMemo(() => {
    if (!candidate) return '';
    return `<p>Dear ${candidate.fullName},</p><p>Appointment as ${employment.appointmentType} with net salary ₹${salary.netSalary.toLocaleString('en-IN')}.</p>${termsHtml}`;
  }, [candidate, employment, salary.netSalary, termsHtml]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">New Appointment Order</h2>
        <p className="text-sm text-muted-foreground">
          4-step wizard — candidate from recruitment only.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 text-xs ${
              i === step ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {step === 0 && (
        <GlassCard className="space-y-3 p-4">
          <Input
            placeholder="Search by name, mobile, application no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto rounded border">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-muted/50"
                onClick={() => selectCandidateMut.mutate(c.id)}
              >
                <span>
                  <strong>{c.fullName}</strong>
                  <span className="ml-2 text-muted-foreground">{c.mobile}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.vacancy?.designation?.label ?? c.vacancy?.title}
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {step === 1 && candidate && (
        <GlassCard className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded bg-muted/40 p-3 text-sm">
            <strong>{String(candidate.fullName)}</strong> — {String(candidate.mobile ?? '')}
          </div>
          <div>
            <Label>Appointment Type</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={employment.appointmentType}
              onChange={(e) => setEmployment((s) => ({ ...s, appointmentType: e.target.value }))}
            >
              {['PROBATIONARY', 'TEMPORARY', 'CONTRACT', 'VISITING_FACULTY', 'GUEST_LECTURER'].map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <Label>Staff Type</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={employment.staffType}
              onChange={(e) => setEmployment((s) => ({ ...s, staffType: e.target.value }))}
            >
              {['TEACHING', 'NON_TEACHING', 'GUEST', 'VISITING', 'CONTRACT'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Joining Date</Label>
            <Input
              type="date"
              value={employment.joiningDate}
              onChange={(e) => setEmployment((s) => ({ ...s, joiningDate: e.target.value }))}
            />
          </div>
          <div>
            <Label>Reporting To</Label>
            <Input
              value={employment.reportingTo}
              onChange={(e) => setEmployment((s) => ({ ...s, reportingTo: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)}>Next: Salary</Button>
          </div>
        </GlassCard>
      )}

      {step === 2 && (
        <GlassCard className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Pay Structure Template</Label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={salary.payStructureTemplateId}
                onChange={(e) =>
                  setSalary((s) => ({ ...s, payStructureTemplateId: e.target.value }))
                }
              >
                <option value="">Select template</option>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Basic Pay (₹)</Label>
              <Input
                type="number"
                value={salary.basicPay}
                onChange={(e) => setSalary((s) => ({ ...s, basicPay: e.target.value }))}
              />
            </div>
          </div>
          <Button
            variant="outline"
            disabled={!salary.payStructureTemplateId || !salary.basicPay}
            onClick={() => previewMut.mutate()}
          >
            Preview Salary Breakup
          </Button>
          {salary.lines.length > 0 && (
            <div className="overflow-x-auto rounded border text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs">
                    <th className="px-3 py-2">Component</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {salary.lines.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-1">{l.name}</td>
                      <td className="px-3 py-1">{l.componentType}</td>
                      <td className="px-3 py-1 text-right">
                        ₹{Number(l.amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="px-3 py-2 font-medium">
                      Net Salary
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      ₹{salary.netSalary.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Next: Terms</Button>
          </div>
        </GlassCard>
      )}

      {step === 3 && (
        <GlassCard className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Label>Terms Template</Label>
            {templates.length === 0 && (
              <Button size="sm" variant="outline" onClick={() => seedMut.mutate()}>
                Seed Default Templates
              </Button>
            )}
          </div>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const tpl = templates.find((t: { id: string }) => t.id === e.target.value) as
                | { versions?: Array<{ bodyHtml: string }> }
                | undefined;
              if (tpl?.versions?.[0]?.bodyHtml) {
                setTermsHtml(tpl.versions[0].bodyHtml);
              }
            }}
          >
            <option value="">Default terms</option>
            {templates.map((t: { id: string; name: string }) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-32 w-full rounded-md border p-3 text-sm"
            value={termsHtml}
            onChange={(e) => setTermsHtml(e.target.value)}
            placeholder="Terms & conditions HTML (optional override)"
          />
          <div
            className="rounded border bg-white p-4 text-sm prose max-w-none"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button disabled={generateMut.isPending} onClick={() => generateMut.mutate()}>
              Generate Appointment Order
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
