'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createJoiningReport,
  fetchAcceptedOrdersForJoining,
  fetchJoiningReports,
  verifyJoiningReport,
} from '@/services/hr-appointment';
import { apiErrorMessage } from '@/utils/api-error';

export function HrJoiningReportsPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    appointmentOrderId: '',
    actualJoiningDate: '',
    remarks: '',
  });

  const reportsQ = useQuery({
    queryKey: ['hr', 'joining-reports'],
    queryFn: () => fetchJoiningReports(),
    enabled,
  });
  const ordersQ = useQuery({
    queryKey: ['hr', 'joining-accepted-orders'],
    queryFn: fetchAcceptedOrdersForJoining,
    enabled,
  });

  const createMut = useMutation({
    mutationFn: () => createJoiningReport(form),
    onSuccess: () => {
      setMessage('Joining report submitted.');
      setForm({ appointmentOrderId: '', actualJoiningDate: '', remarks: '' });
      void qc.invalidateQueries({ queryKey: ['hr', 'joining-reports'] });
      void qc.invalidateQueries({ queryKey: ['hr', 'joining-accepted-orders'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not create report')),
  });

  const verifyMut = useMutation({
    mutationFn: (id: string) => verifyJoiningReport(id),
    onSuccess: () => {
      setMessage('Joining verified — staff activated.');
      void qc.invalidateQueries({ queryKey: ['hr', 'joining-reports'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Verification failed')),
  });

  const reports = reportsQ.data ?? [];
  const acceptedOrders = ordersQ.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Joining Reports</h2>
        <p className="text-sm text-muted-foreground">
          Submit and verify joining reports for accepted appointment orders.
        </p>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <GlassCard className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2 font-medium">New Joining Report</div>
        <div>
          <Label>Accepted Order</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={form.appointmentOrderId}
            onChange={(e) => setForm((f) => ({ ...f, appointmentOrderId: e.target.value }))}
          >
            <option value="">Select order</option>
            {acceptedOrders.map((o: { id: string; orderNo?: string; candidateName: string }) => (
              <option key={o.id} value={o.id}>
                {o.orderNo ?? 'Draft'} — {o.candidateName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Actual Joining Date</Label>
          <Input
            type="date"
            value={form.actualJoiningDate}
            onChange={(e) => setForm((f) => ({ ...f, actualJoiningDate: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Remarks</Label>
          <Input
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          />
        </div>
        <div>
          <Button
            disabled={!form.appointmentOrderId || !form.actualJoiningDate}
            onClick={() => createMut.mutate()}
          >
            Submit Report
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="border-b px-4 py-3 font-medium">Reports</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2">Candidate</th>
              <th className="px-4 py-2">Joining Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Staff</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-4 py-2">{r.appointmentOrder?.candidateName}</td>
                <td className="px-4 py-2">
                  {new Date(r.actualJoiningDate).toLocaleDateString('en-IN')}
                </td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">
                  {r.staffProfile ? (
                    <Link
                      href={`/admin/staff/${r.staffProfile.id}`}
                      className="text-primary hover:underline"
                    >
                      {r.staffProfile.employeeCode}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.status === 'SUBMITTED' && (
                    <Button size="sm" onClick={() => verifyMut.mutate(r.id)}>
                      Verify & Activate
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!reports.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No joining reports yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
