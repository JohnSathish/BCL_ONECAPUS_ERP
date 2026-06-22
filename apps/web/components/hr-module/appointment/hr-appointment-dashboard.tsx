'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAppointmentDashboard, fetchAppointmentOrders } from '@/services/hr-appointment';

const KPI = [
  { key: 'issued', label: 'Issued' },
  { key: 'pendingAcceptance', label: 'Pending Acceptance' },
  { key: 'joined', label: 'Joined' },
  { key: 'notJoined', label: 'Not Joined' },
  { key: 'probation', label: 'On Probation' },
  { key: 'confirmed', label: 'Confirmed' },
] as const;

export function HrAppointmentDashboardPage() {
  const enabled = useAuthQueryEnabled();
  const dashQ = useQuery({
    queryKey: ['hr', 'appointment-orders', 'dashboard'],
    queryFn: fetchAppointmentDashboard,
    enabled,
  });
  const ordersQ = useQuery({
    queryKey: ['hr', 'appointment-orders', 'list'],
    queryFn: () => fetchAppointmentOrders(),
    enabled,
  });

  const dash = dashQ.data as Record<string, number> | undefined;
  const orders = ordersQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Appointment Orders</h2>
          <p className="text-sm text-muted-foreground">
            Issue appointment letters from recruitment selections.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/hr/appointment-orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPI.map((k) => (
          <GlassCard key={k.key} className="p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold">{dash?.[k.key] ?? '—'}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="overflow-hidden">
        <div className="border-b px-4 py-3 font-medium">Recent Orders</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Order No</th>
                <th className="px-4 py-2">Candidate</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Net Salary</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 20).map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{o.orderNo ?? 'Draft'}</td>
                  <td className="px-4 py-2">{o.candidateName}</td>
                  <td className="px-4 py-2">{o.appointmentType}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{o.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    {o.netSalary ? `₹${Number(o.netSalary).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/hr/appointment-orders/${o.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {!orders.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No appointment orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
