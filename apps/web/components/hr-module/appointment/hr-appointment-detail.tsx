'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  acceptAppointmentOrder,
  appointmentOrderPdfUrl,
  cancelAppointmentOrder,
  fetchAppointmentOrder,
  reissueAppointmentOrder,
  rejectAppointmentOrder,
  sendAppointmentOrder,
} from '@/services/hr-appointment';
import { apiErrorMessage } from '@/utils/api-error';

export function HrAppointmentDetailPage({ orderId }: { orderId: string }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [signedCopyUrl, setSignedCopyUrl] = useState('');
  const [message, setMessage] = useState('');

  const orderQ = useQuery({
    queryKey: ['hr', 'appointment-order', orderId],
    queryFn: () => fetchAppointmentOrder(orderId),
    enabled: enabled && !!orderId,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['hr', 'appointment-order', orderId] });
    void qc.invalidateQueries({ queryKey: ['hr', 'appointment-orders'] });
  };

  const actionMut = useMutation({
    mutationFn: async (action: string) => {
      if (action === 'send') return sendAppointmentOrder(orderId);
      if (action === 'accept')
        return acceptAppointmentOrder(orderId, { signedCopyUrl: signedCopyUrl || undefined });
      if (action === 'reject') return rejectAppointmentOrder(orderId, rejectReason);
      if (action === 'cancel') return cancelAppointmentOrder(orderId);
      if (action === 'reissue') return reissueAppointmentOrder(orderId);
      throw new Error('Unknown action');
    },
    onSuccess: (data, action) => {
      setMessage(`Order ${action} successful.`);
      invalidate();
      if (action === 'reissue' && data?.id) {
        window.location.href = `/admin/hr/appointment-orders/${data.id}`;
      }
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Action failed')),
  });

  const order = orderQ.data;
  if (orderQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!order) return <p className="text-sm text-muted-foreground">Order not found.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{order.orderNo ?? 'Draft Order'}</h2>
          <p className="text-sm text-muted-foreground">{order.candidateName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.pdfPath || order.status !== 'DRAFT' ? (
            <Button variant="outline" asChild>
              <a href={appointmentOrderPdfUrl(orderId)} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/admin/hr/appointment-orders">Back</Link>
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="space-y-2 p-4 lg:col-span-1">
          <p>
            <span className="text-muted-foreground">Status:</span> <strong>{order.status}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Type:</span> {order.appointmentType}
          </p>
          <p>
            <span className="text-muted-foreground">Net Salary:</span>{' '}
            {order.netSalary ? `₹${Number(order.netSalary).toLocaleString('en-IN')}` : '—'}
          </p>
          {order.verifyCode ? (
            <p className="font-mono text-xs">Verify: {order.verifyCode}</p>
          ) : null}

          <div className="space-y-2 border-t pt-3">
            {order.status === 'GENERATED' && (
              <Button className="w-full" onClick={() => actionMut.mutate('send')}>
                Mark as Sent
              </Button>
            )}
            {order.status === 'SENT' && (
              <>
                <Input
                  placeholder="Signed copy URL (optional)"
                  value={signedCopyUrl}
                  onChange={(e) => setSignedCopyUrl(e.target.value)}
                />
                <Button className="w-full" onClick={() => actionMut.mutate('accept')}>
                  Mark Accepted
                </Button>
                <Input
                  placeholder="Rejection reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => actionMut.mutate('reject')}
                >
                  Reject
                </Button>
              </>
            )}
            {order.status === 'ACCEPTED' && (
              <Button variant="outline" className="w-full" asChild>
                <Link href="/admin/hr/joining-reports">Create Joining Report</Link>
              </Button>
            )}
            {!['JOINED', 'CANCELLED'].includes(order.status) && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => actionMut.mutate('cancel')}
              >
                Cancel Order
              </Button>
            )}
            {['GENERATED', 'SENT', 'REJECTED', 'ACCEPTED'].includes(order.status) && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => actionMut.mutate('reissue')}
              >
                Re-issue (New Revision)
              </Button>
            )}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2 overflow-hidden">
          <div className="border-b px-4 py-2 text-sm font-medium">Preview</div>
          {order.renderedHtml ? (
            <iframe
              title="Appointment order preview"
              className="h-[70vh] w-full bg-white"
              srcDoc={order.renderedHtml}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Generate the order to see preview.</p>
          )}
        </GlassCard>
      </div>

      {order.auditLogs?.length ? (
        <GlassCard className="p-4">
          <h3 className="mb-2 font-medium">Audit Timeline</h3>
          <ul className="space-y-1 text-sm">
            {order.auditLogs.map((log) => (
              <li key={log.id} className="flex justify-between border-b py-1">
                <span>{log.action}</span>
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}
    </div>
  );
}
