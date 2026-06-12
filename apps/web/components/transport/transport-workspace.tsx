'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bus, MapPin, Users } from 'lucide-react';

import {
  TransportAssignmentDeskHint,
  TransportStudentPicker,
} from '@/components/transport/transport-phase2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  addTransportStop,
  assignTransportStudent,
  cancelTransportAssignment,
  createTransportRoute,
  createTransportVehicle,
  fetchTransportAssignments,
  fetchTransportDashboard,
  fetchTransportRoutes,
  fetchTransportVehicles,
} from '@/services/transport';
import { apiErrorMessage } from '@/utils/api-error';

type Page = 'dashboard' | 'routes' | 'vehicles' | 'assignments';

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function TransportWorkspace({ page = 'dashboard' }: { page?: Page }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');

  const dashboard = useQuery({
    queryKey: ['transport', 'dashboard'],
    queryFn: fetchTransportDashboard,
    enabled,
  });
  const routes = useQuery({
    queryKey: ['transport', 'routes'],
    queryFn: () => fetchTransportRoutes(),
    enabled: enabled && (page === 'routes' || page === 'assignments' || page === 'vehicles'),
  });
  const vehicles = useQuery({
    queryKey: ['transport', 'vehicles'],
    queryFn: () => fetchTransportVehicles(),
    enabled: enabled && page === 'vehicles',
  });
  const assignments = useQuery({
    queryKey: ['transport', 'assignments'],
    queryFn: () => fetchTransportAssignments({ status: 'ACTIVE' }),
    enabled: enabled && page === 'assignments',
  });

  const [routeForm, setRouteForm] = useState({
    code: '',
    name: '',
    startPoint: '',
    endPoint: '',
    fareAmount: '',
  });
  const [stopForm, setStopForm] = useState({ routeId: '', name: '', pickupTime: '' });
  const [vehicleForm, setVehicleForm] = useState({
    registrationNo: '',
    capacity: 40,
    driverName: '',
    driverMobile: '',
    routeId: '',
  });
  const [assignForm, setAssignForm] = useState({ studentId: '', routeId: '', stopId: '' });

  const routeMut = useMutation({
    mutationFn: () =>
      createTransportRoute({
        ...routeForm,
        fareAmount: routeForm.fareAmount ? Number(routeForm.fareAmount) : undefined,
      }),
    onSuccess: () => {
      setMessage('Route created');
      setRouteForm({ code: '', name: '', startPoint: '', endPoint: '', fareAmount: '' });
      void qc.invalidateQueries({ queryKey: ['transport'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const stopMut = useMutation({
    mutationFn: () =>
      addTransportStop(stopForm.routeId, { name: stopForm.name, pickupTime: stopForm.pickupTime }),
    onSuccess: () => {
      setMessage('Stop added');
      setStopForm({ routeId: '', name: '', pickupTime: '' });
      void qc.invalidateQueries({ queryKey: ['transport'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const vehicleMut = useMutation({
    mutationFn: () =>
      createTransportVehicle({
        ...vehicleForm,
        routeId: vehicleForm.routeId || undefined,
      }),
    onSuccess: () => {
      setMessage('Vehicle registered');
      setVehicleForm({
        registrationNo: '',
        capacity: 40,
        driverName: '',
        driverMobile: '',
        routeId: '',
      });
      void qc.invalidateQueries({ queryKey: ['transport'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const assignMut = useMutation({
    mutationFn: () =>
      assignTransportStudent({
        studentId: assignForm.studentId,
        routeId: assignForm.routeId,
        stopId: assignForm.stopId || undefined,
      }),
    onSuccess: (row) => {
      setMessage(`Student assigned — parent notify: ${row.notificationStatus ?? 'pending'}`);
      setAssignForm({ studentId: '', routeId: '', stopId: '' });
      void qc.invalidateQueries({ queryKey: ['transport'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  if (page === 'dashboard') {
    const d = dashboard.data;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Bus className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Transport</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Active Routes" value={d?.activeRoutes ?? '—'} />
          <Kpi label="Vehicles" value={d?.activeVehicles ?? '—'} />
          <Kpi label="Students Assigned" value={d?.assignedStudents ?? '—'} />
          <Kpi label="Utilization" value={d ? `${d.utilizationPercent}%` : '—'} />
          <Kpi label="At Capacity" value={d?.routesAtCapacity ?? '—'} />
          <Kpi label="Near Capacity" value={d?.routesNearCapacity ?? '—'} />
        </div>
        {d?.capacityAlerts?.length ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Capacity alerts
            </h2>
            <ul className="space-y-1 text-sm">
              {d.capacityAlerts.map((a) => (
                <li key={a.routeId} className="flex justify-between">
                  <span>
                    {a.code} — {a.name}
                  </span>
                  <span>
                    {a.assigned}/{a.capacity} ({a.utilizationPct}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium">Route load</h2>
          <ul className="space-y-2 text-sm">
            {d?.routeLoad.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>
                  {r.code} — {r.name}
                </span>
                <span
                  className={
                    r.atCapacity
                      ? 'font-medium text-destructive'
                      : r.nearCapacity
                        ? 'text-amber-700'
                        : ''
                  }
                >
                  {r.assigned}/{r.capacity || '—'}
                  {r.utilizationPct != null ? ` (${r.utilizationPct}%)` : ''}
                </span>
              </li>
            ))}
            {!d?.routeLoad.length ? <li className="text-muted-foreground">No routes yet</li> : null}
          </ul>
        </div>
      </div>
    );
  }

  if (page === 'routes') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Routes & Stops</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-6">
          <Input
            placeholder="Code"
            value={routeForm.code}
            onChange={(e) => setRouteForm({ ...routeForm, code: e.target.value })}
          />
          <Input
            placeholder="Name"
            value={routeForm.name}
            onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
          />
          <Input
            placeholder="Start"
            value={routeForm.startPoint}
            onChange={(e) => setRouteForm({ ...routeForm, startPoint: e.target.value })}
          />
          <Input
            placeholder="End"
            value={routeForm.endPoint}
            onChange={(e) => setRouteForm({ ...routeForm, endPoint: e.target.value })}
          />
          <Input
            placeholder="Fare"
            value={routeForm.fareAmount}
            onChange={(e) => setRouteForm({ ...routeForm, fareAmount: e.target.value })}
          />
          <Button disabled={routeMut.isPending} onClick={() => routeMut.mutate()}>
            Add Route
          </Button>
        </div>
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-4">
          <select
            className="rounded border px-2 py-2 text-sm"
            value={stopForm.routeId}
            onChange={(e) => setStopForm({ ...stopForm, routeId: e.target.value })}
          >
            <option value="">Select route</option>
            {routes.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Stop name"
            value={stopForm.name}
            onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
          />
          <Input
            placeholder="Pickup time"
            value={stopForm.pickupTime}
            onChange={(e) => setStopForm({ ...stopForm, pickupTime: e.target.value })}
          />
          <Button
            disabled={stopMut.isPending || !stopForm.routeId}
            onClick={() => stopMut.mutate()}
          >
            Add Stop
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Code</th>
              <th className="p-2 text-left">Route</th>
              <th className="p-2 text-left">Stops</th>
              <th className="p-2 text-left">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {routes.data?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono">{r.code}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.stops?.map((s) => s.name).join(', ') || '—'}</td>
                <td className="p-2">{r._count?.assignments ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (page === 'vehicles') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Vehicles</h1>
        </div>
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-6">
          <Input
            placeholder="Registration"
            value={vehicleForm.registrationNo}
            onChange={(e) => setVehicleForm({ ...vehicleForm, registrationNo: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Capacity"
            value={vehicleForm.capacity}
            onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) })}
          />
          <Input
            placeholder="Driver"
            value={vehicleForm.driverName}
            onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
          />
          <Input
            placeholder="Driver mobile"
            value={vehicleForm.driverMobile}
            onChange={(e) => setVehicleForm({ ...vehicleForm, driverMobile: e.target.value })}
          />
          <select
            className="rounded border px-2 py-2 text-sm"
            value={vehicleForm.routeId}
            onChange={(e) => setVehicleForm({ ...vehicleForm, routeId: e.target.value })}
          >
            <option value="">Route (optional)</option>
            {routes.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}
              </option>
            ))}
          </select>
          <Button disabled={vehicleMut.isPending} onClick={() => vehicleMut.mutate()}>
            Register
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Reg No</th>
              <th className="p-2 text-left">Capacity</th>
              <th className="p-2 text-left">Driver</th>
              <th className="p-2 text-left">Route</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.data?.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="p-2">{v.registrationNo}</td>
                <td className="p-2">{v.capacity}</td>
                <td className="p-2">{v.driverName ?? '—'}</td>
                <td className="p-2">{v.route?.code ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (page === 'assignments') {
    const selectedRoute = routes.data?.find((r) => r.id === assignForm.routeId);
    const routeCapacity = selectedRoute?.vehicles?.reduce((sum, v) => sum + v.capacity, 0) ?? 0;
    const routeAssigned = selectedRoute?._count?.assignments ?? 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Student Assignments</h1>
        </div>
        <TransportAssignmentDeskHint />
        {message ? <p className="text-sm">{message}</p> : null}
        <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
          <TransportStudentPicker
            value={assignForm.studentId}
            onSelect={(s) => setAssignForm({ ...assignForm, studentId: s.id })}
          />
          <div className="space-y-2">
            <select
              className="w-full rounded border px-2 py-2 text-sm"
              value={assignForm.routeId}
              onChange={(e) =>
                setAssignForm({ ...assignForm, routeId: e.target.value, stopId: '' })
              }
            >
              <option value="">Select route</option>
              {routes.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
            {assignForm.routeId && routeCapacity > 0 ? (
              <p
                className={`text-xs ${routeAssigned >= routeCapacity ? 'text-destructive' : routeAssigned >= Math.ceil(routeCapacity * 0.9) ? 'text-amber-700' : 'text-muted-foreground'}`}
              >
                Route load: {routeAssigned}/{routeCapacity} seats
              </p>
            ) : null}
            <select
              className="w-full rounded border px-2 py-2 text-sm"
              value={assignForm.stopId}
              onChange={(e) => setAssignForm({ ...assignForm, stopId: e.target.value })}
            >
              <option value="">Pickup stop (optional)</option>
              {selectedRoute?.stops?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              disabled={assignMut.isPending || !assignForm.studentId || !assignForm.routeId}
              onClick={() => assignMut.mutate()}
            >
              Assign & notify parents
            </Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Student</th>
              <th className="p-2 text-left">Route</th>
              <th className="p-2 text-left">Stop</th>
              <th className="p-2 text-left">Parent notify</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {assignments.data?.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.studentName ?? a.enrollmentNumber ?? a.studentId}</td>
                <td className="p-2">{a.route?.code ?? '—'}</td>
                <td className="p-2">{a.stop?.name ?? '—'}</td>
                <td className="p-2">{a.notificationStatus ?? '—'}</td>
                <td className="p-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await cancelTransportAssignment(a.id);
                      void qc.invalidateQueries({ queryKey: ['transport'] });
                    }}
                  >
                    Cancel
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
