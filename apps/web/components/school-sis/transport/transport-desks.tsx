'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  endTransportAllocation,
  fetchTransportAllocations,
  fetchTransportDashboard,
  fetchTransportFeePlans,
  fetchTransportFuel,
  fetchTransportIncidents,
  fetchTransportMaintenance,
  fetchTransportPersonnel,
  fetchTransportRequests,
  fetchTransportRoster,
  fetchTransportRoutes,
  fetchTransportSettings,
  fetchTransportStops,
  fetchTransportTracking,
  fetchTransportTrips,
  fetchTransportVehicles,
  generateTransportTrips,
  resolveTransportIncident,
  reviewTransportRequest,
  saveTransportAllocation,
  saveTransportFeePlan,
  saveTransportFuel,
  saveTransportIncident,
  saveTransportMaintenance,
  saveTransportPersonnel,
  saveTransportRoute,
  saveTransportSettings,
  saveTransportStop,
  saveTransportVehicle,
  saveTransportVehicleDocument,
  searchTransportStudents,
  transportBoarding,
  transportBulkAttendance,
  transportTripAction,
} from '@/services/school-sis';
import { Badge, ConfirmBar, Kpi, TransportShell, fieldClass } from './transport-ui';

type View =
  | 'dashboard'
  | 'vehicles'
  | 'routes'
  | 'stops'
  | 'drivers'
  | 'attendants'
  | 'allocations'
  | 'trips'
  | 'tracking'
  | 'incidents'
  | 'maintenance'
  | 'fuel'
  | 'fees'
  | 'requests'
  | 'settings';

function useDash() {
  const enabled = useAuthQueryEnabled();
  return useQuery({ queryKey: ['tr-dash'], queryFn: fetchTransportDashboard, enabled });
}

export function TransportDashboardDesk() {
  const q = useDash();
  const k = q.data?.kpis;
  const year = q.data?.academicYear?.name ?? 'Academic year';
  return (
    <TransportShell
      title="Transport Management"
      subtitle={year}
      extra={
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white"
            href="/admin/school-sis/transport/vehicles"
          >
            + Add Vehicle
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            href="/admin/school-sis/transport/routes"
          >
            + Create Route
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            href="/admin/school-sis/transport/allocations"
          >
            + Assign Student
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            href="/admin/school-sis/transport/tracking"
          >
            Track Vehicles
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            href="/admin/school-sis/reports"
          >
            Reports
          </Link>
        </div>
      }
    >
      {q.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Total Vehicles" value={k?.totalVehicles ?? '—'} tone="blue" />
        <Kpi label="Active Vehicles" value={k?.activeVehicles ?? '—'} tone="green" />
        <Kpi label="Under Maintenance" value={k?.vehiclesUnderMaintenance ?? '—'} tone="amber" />
        <Kpi label="Total Routes" value={k?.totalRoutes ?? '—'} />
        <Kpi label="Active Routes" value={k?.activeRoutes ?? '—'} />
        <Kpi
          label="Students Using Transport"
          value={k?.studentsUsingTransport ?? '—'}
          tone="blue"
        />
        <Kpi label="Students Not Assigned" value={k?.studentsNotAssigned ?? '—'} />
        <Kpi label="Drivers" value={k?.drivers ?? '—'} />
        <Kpi label="Attendants" value={k?.attendants ?? '—'} />
        <Kpi label="Today's Trips" value={k?.todaysTrips ?? '—'} />
        <Kpi label="Today's Boarding" value={k?.todaysBoarding ?? '—'} tone="green" />
        <Kpi label="Today's Drop-off" value={k?.todaysDropoff ?? '—'} />
        <Kpi label="Transport Fee Pending" value={k?.transportFeePending ?? '—'} tone="amber" />
        <Kpi label="Expiring Documents" value={k?.expiringDocuments ?? '—'} tone="amber" />
        <Kpi label="Active Emergencies" value={k?.activeEmergencies ?? '—'} tone="rose" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold text-slate-800">Maintenance this month</h2>
          <p className="mt-2 text-2xl font-semibold">
            ₹{((k?.maintenanceCostThisMonth ?? 0) / 100).toFixed(0)}
          </p>
          <p className="text-slate-500">
            Upcoming {k?.upcomingService ?? 0} · Overdue {k?.overdueService ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold text-slate-800">Fuel this month</h2>
          <p className="mt-2 text-2xl font-semibold">
            ₹{((k?.fuelCostThisMonth ?? 0) / 100).toFixed(0)}
          </p>
          <p className="text-slate-500">Expected mileage is school-configured, not hardcoded.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold text-slate-800">GPS</h2>
          <p className="mt-2 text-slate-600">
            {q.data?.map?.gpsEnabled
              ? 'Live tracking enabled'
              : 'Core transport works without GPS. Enable it in Settings when devices are ready.'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Map provider: {q.data?.map?.provider ?? 'OSM'}
          </p>
        </div>
      </div>
    </TransportShell>
  );
}

export function TransportVehiclesDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    registrationNumber: '',
    code: '',
    vehicleType: 'SCHOOL_BUS',
    seatingCapacity: '40',
    make: '',
    model: '',
    fuelType: 'DIESEL',
    fleetRole: 'PRIMARY',
  });
  const [doc, setDoc] = useState({
    vehicleId: '',
    kind: 'INSURANCE',
    expiryDate: '',
    documentNumber: '',
  });
  const q = useQuery({
    queryKey: ['tr-veh', search],
    queryFn: () => fetchTransportVehicles({ search, limit: 50 }),
    enabled,
  });
  const save = useMutation({
    mutationFn: () =>
      saveTransportVehicle({
        ...form,
        seatingCapacity: Number(form.seatingCapacity || 0),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tr-veh'] });
      setOpen(false);
    },
  });
  const saveDoc = useMutation({
    mutationFn: () => saveTransportVehicleDocument(doc.vehicleId, doc),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-veh'] }),
  });
  return (
    <TransportShell
      title="Vehicles"
      extra={
        <button
          type="button"
          className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => setOpen(true)}
        >
          + Add Vehicle
        </button>
      }
    >
      <input
        className={`${fieldClass} max-w-sm`}
        placeholder="Search registration or code"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                'Vehicle',
                'Reg.',
                'Type',
                'Capacity',
                'Route',
                'Driver',
                'GPS',
                'Insurance',
                'Fitness',
                'Permit',
                'Pollution',
                'Status',
              ].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(q.data?.items ?? []).map((v: any) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{v.code}</td>
                <td className="px-3 py-2">{v.registrationNumber}</td>
                <td className="px-3 py-2">{v.vehicleType}</td>
                <td className="px-3 py-2">
                  {v._count?.allocations ?? 0}/{v.totalCapacity}{' '}
                  <Badge value={v.capacity?.band ?? 'NORMAL'} />
                </td>
                <td className="px-3 py-2">{v.assignedRoute ?? '—'}</td>
                <td className="px-3 py-2">{v.driver ?? '—'}</td>
                <td className="px-3 py-2">
                  <Badge value={v.gpsStatus} />
                </td>
                <td className="px-3 py-2">
                  <Badge value={v.insuranceStatus} />
                </td>
                <td className="px-3 py-2">
                  <Badge value={v.fitnessStatus} />
                </td>
                <td className="px-3 py-2">
                  <Badge value={v.permitStatus} />
                </td>
                <td className="px-3 py-2">
                  <Badge value={v.pollutionStatus} />
                </td>
                <td className="px-3 py-2">
                  <Badge value={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">New vehicle</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              className={fieldClass}
              placeholder="Registration"
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
            />
            <input
              className={fieldClass}
              placeholder="Code (optional)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <select
              className={fieldClass}
              value={form.vehicleType}
              onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
            >
              {['SCHOOL_BUS', 'MINI_BUS', 'VAN', 'CAR', 'OTHER'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              className={fieldClass}
              placeholder="Make"
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
            />
            <input
              className={fieldClass}
              placeholder="Model"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
            <input
              className={fieldClass}
              placeholder="Seats"
              value={form.seatingCapacity}
              onChange={(e) => setForm({ ...form, seatingCapacity: e.target.value })}
            />
            <select
              className={fieldClass}
              value={form.fleetRole}
              onChange={(e) => setForm({ ...form, fleetRole: e.target.value })}
            >
              <option>PRIMARY</option>
              <option>BACKUP</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
              onClick={() => save.mutate()}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Add document</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <select
            className={fieldClass}
            value={doc.vehicleId}
            onChange={(e) => setDoc({ ...doc, vehicleId: e.target.value })}
          >
            <option value="">Vehicle</option>
            {(q.data?.items ?? []).map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.registrationNumber}
              </option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={doc.kind}
            onChange={(e) => setDoc({ ...doc, kind: e.target.value })}
          >
            {['RC', 'INSURANCE', 'FITNESS', 'ROAD_TAX', 'PERMIT', 'POLLUTION', 'OTHER'].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <input
            className={fieldClass}
            placeholder="Number"
            value={doc.documentNumber}
            onChange={(e) => setDoc({ ...doc, documentNumber: e.target.value })}
          />
          <input
            className={fieldClass}
            type="date"
            value={doc.expiryDate}
            onChange={(e) => setDoc({ ...doc, expiryDate: e.target.value })}
          />
        </div>
        <button
          type="button"
          className="mt-3 rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
          onClick={() => saveDoc.mutate()}
          disabled={!doc.vehicleId}
        >
          Save document
        </button>
      </div>
    </TransportShell>
  );
}

function PersonnelDesk({ kind }: { kind: 'DRIVER' | 'ATTENDANT' }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    licenseNumber: '',
    licenseExpiry: '',
    status: 'ACTIVE',
  });
  const q = useQuery({
    queryKey: ['tr-per', kind],
    queryFn: () => fetchTransportPersonnel(kind, { limit: 50 }),
    enabled,
  });
  const save = useMutation({
    mutationFn: () => saveTransportPersonnel({ ...form, kind }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-per', kind] }),
  });
  return (
    <TransportShell title={kind === 'DRIVER' ? 'Drivers' : 'Attendants'}>
      <div className="grid gap-3 md:grid-cols-5">
        <input
          className={fieldClass}
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Mobile"
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
        />
        {kind === 'DRIVER' ? (
          <>
            <input
              className={fieldClass}
              placeholder="Licence no."
              value={form.licenseNumber}
              onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
            />
            <input
              className={fieldClass}
              type="date"
              value={form.licenseExpiry}
              onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
            />
          </>
        ) : null}
        <button
          type="button"
          className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
          onClick={() => save.mutate()}
        >
          Save
        </button>
      </div>
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Mobile</th>
              <th className="px-3 py-2 text-left">Licence</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.items ?? []).map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.fullName}</td>
                <td className="px-3 py-2">{p.mobile}</td>
                <td className="px-3 py-2">
                  <Badge value={p.licenseStatus ?? 'UNKNOWN'} />
                </td>
                <td className="px-3 py-2">
                  <Badge value={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TransportShell>
  );
}

export function TransportDriversDesk() {
  return <PersonnelDesk kind="DRIVER" />;
}
export function TransportAttendantsDesk() {
  return <PersonnelDesk kind="ATTENDANT" />;
}

export function TransportStopsDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    landmark: '',
    morningPickup: '',
    afternoonDrop: '',
    safetyJson: { parentInstructions: '', safeWaitingPoint: '' },
  });
  const q = useQuery({
    queryKey: ['tr-stops'],
    queryFn: () => fetchTransportStops({ limit: 50 }),
    enabled,
  });
  const save = useMutation({
    mutationFn: () => saveTransportStop(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-stops'] }),
  });
  return (
    <TransportShell title="Stops">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className={fieldClass}
          placeholder="Stop name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Landmark"
          value={form.landmark}
          onChange={(e) => setForm({ ...form, landmark: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Safe waiting point"
          value={form.safetyJson.safeWaitingPoint}
          onChange={(e) =>
            setForm({
              ...form,
              safetyJson: { ...form.safetyJson, safeWaitingPoint: e.target.value },
            })
          }
        />
        <input
          className={fieldClass}
          placeholder="Parent instructions"
          value={form.safetyJson.parentInstructions}
          onChange={(e) =>
            setForm({
              ...form,
              safetyJson: { ...form.safetyJson, parentInstructions: e.target.value },
            })
          }
        />
        <input
          className={fieldClass}
          placeholder="Pickup time"
          value={form.morningPickup}
          onChange={(e) => setForm({ ...form, morningPickup: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Drop time"
          value={form.afternoonDrop}
          onChange={(e) => setForm({ ...form, afternoonDrop: e.target.value })}
        />
      </div>
      <button
        type="button"
        className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
        onClick={() => save.mutate()}
      >
        Save stop
      </button>
      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Stop</th>
              <th className="px-3 py-2 text-left">Route</th>
              <th className="px-3 py-2 text-left">Pickup</th>
              <th className="px-3 py-2 text-left">Drop</th>
              <th className="px-3 py-2 text-left">Students</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.items ?? []).map((s: any) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{s.routeStops?.[0]?.route?.name ?? '—'}</td>
                <td className="px-3 py-2">{s.morningPickup ?? '—'}</td>
                <td className="px-3 py-2">{s.afternoonDrop ?? '—'}</td>
                <td className="px-3 py-2">{s._count?.pickupAllocations ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TransportShell>
  );
}

export function TransportRoutesDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const routes = useQuery({
    queryKey: ['tr-routes'],
    queryFn: () => fetchTransportRoutes({ limit: 50 }),
    enabled,
  });
  const vehicles = useQuery({
    queryKey: ['tr-veh'],
    queryFn: () => fetchTransportVehicles({ limit: 50 }),
    enabled,
  });
  const drivers = useQuery({
    queryKey: ['tr-per', 'DRIVER'],
    queryFn: () => fetchTransportPersonnel('DRIVER'),
    enabled,
  });
  const attendants = useQuery({
    queryKey: ['tr-per', 'ATTENDANT'],
    queryFn: () => fetchTransportPersonnel('ATTENDANT'),
    enabled,
  });
  const stops = useQuery({
    queryKey: ['tr-stops'],
    queryFn: () => fetchTransportStops({ limit: 50 }),
    enabled,
  });
  const [form, setForm] = useState({
    name: '',
    startPoint: '',
    endPoint: 'School',
    vehicleId: '',
    driverId: '',
    attendantId: '',
    routeType: 'BOTH',
    stopId: '',
  });
  const save = useMutation({
    mutationFn: () =>
      saveTransportRoute({
        ...form,
        stops: form.stopId ? [{ stopId: form.stopId, stopNumber: 1 }] : [],
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-routes'] }),
  });
  return (
    <TransportShell title="Routes">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className={fieldClass}
          placeholder="Route name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Start"
          value={form.startPoint}
          onChange={(e) => setForm({ ...form, startPoint: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="End"
          value={form.endPoint}
          onChange={(e) => setForm({ ...form, endPoint: e.target.value })}
        />
        <select
          className={fieldClass}
          value={form.vehicleId}
          onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
        >
          <option value="">Vehicle</option>
          {(vehicles.data?.items ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.registrationNumber}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={form.driverId}
          onChange={(e) => setForm({ ...form, driverId: e.target.value })}
        >
          <option value="">Driver</option>
          {(drivers.data?.items ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.fullName}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={form.attendantId}
          onChange={(e) => setForm({ ...form, attendantId: e.target.value })}
        >
          <option value="">Attendant</option>
          {(attendants.data?.items ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.fullName}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={form.stopId}
          onChange={(e) => setForm({ ...form, stopId: e.target.value })}
        >
          <option value="">First stop</option>
          {(stops.data?.items ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
          onClick={() => save.mutate()}
        >
          Save route
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(routes.data?.items ?? []).map((r: any) => (
          <div key={r.id} className="rounded-xl border bg-white p-4">
            <div className="flex justify-between">
              <div>
                <p className="text-xs text-slate-500">{r.code}</p>
                <h2 className="font-semibold">{r.name}</h2>
                <p className="text-sm text-slate-500">
                  {r.startPoint} → {r.endPoint || 'School'}
                </p>
              </div>
              <Badge value={r.status} />
            </div>
            <p className="mt-2 text-sm">
              {r.vehicle?.registrationNumber ?? 'No vehicle'} · {r.driver?.fullName ?? 'No driver'}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-[#2563eb]"
                style={{
                  width: `${Math.min(100, r.capacity?.band === 'OVER' ? 100 : ((r.assigned ?? 0) / Math.max(1, r.maxCapacity || r.vehicle?.totalCapacity || 1)) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {r.assigned ?? 0} / {r.maxCapacity || r.vehicle?.totalCapacity || 0} students ·{' '}
              <Badge value={r.capacity?.band ?? 'NORMAL'} />
            </p>
          </div>
        ))}
      </div>
    </TransportShell>
  );
}

export function TransportAllocationsDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const students = useQuery({
    queryKey: ['tr-stu', q],
    queryFn: () => searchTransportStudents(q),
    enabled: enabled && q.length > 1,
  });
  const routes = useQuery({
    queryKey: ['tr-routes'],
    queryFn: () => fetchTransportRoutes({ limit: 50 }),
    enabled,
  });
  const stops = useQuery({
    queryKey: ['tr-stops'],
    queryFn: () => fetchTransportStops({ limit: 50 }),
    enabled,
  });
  const list = useQuery({
    queryKey: ['tr-alloc'],
    queryFn: () => fetchTransportAllocations({ limit: 50 }),
    enabled,
  });
  const [form, setForm] = useState({
    studentId: '',
    routeId: '',
    pickupStopId: '',
    dropStopId: '',
    tripMode: 'BOTH',
    validFrom: new Date().toISOString().slice(0, 10),
    isTemporary: false,
  });
  const save = useMutation({
    mutationFn: () => saveTransportAllocation(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-alloc'] }),
  });
  const end = useMutation({
    mutationFn: (id: string) => endTransportAllocation(id, 'Removed from route'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-alloc'] }),
  });
  return (
    <TransportShell title="Student Allocation">
      <input
        className={`${fieldClass} max-w-lg`}
        placeholder="Search name / admission no. / parent mobile"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid gap-2 md:grid-cols-2">
        {(students.data ?? []).map((s: any) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setForm({ ...form, studentId: s.id })}
            className={`rounded-xl border p-3 text-left ${form.studentId === s.id ? 'border-[#2563eb] bg-sky-50' : 'bg-white'}`}
          >
            <p className="font-medium">{s.fullName}</p>
            <p className="text-xs text-slate-500">
              {s.admissionNumber} · {s.enrollments?.[0]?.section?.grade?.name ?? ''}
            </p>
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <select
          className={fieldClass}
          value={form.routeId}
          onChange={(e) => setForm({ ...form, routeId: e.target.value })}
        >
          <option value="">Route</option>
          {(routes.data?.items ?? []).map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={form.pickupStopId}
          onChange={(e) =>
            setForm({ ...form, pickupStopId: e.target.value, dropStopId: e.target.value })
          }
        >
          <option value="">Stop</option>
          {(stops.data?.items ?? []).map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={form.tripMode}
          onChange={(e) => setForm({ ...form, tripMode: e.target.value })}
        >
          <option value="BOTH">Pickup + Drop</option>
          <option value="PICKUP">Pickup only</option>
          <option value="DROP">Drop only</option>
        </select>
        <input
          className={fieldClass}
          type="date"
          value={form.validFrom}
          onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isTemporary}
          onChange={(e) => setForm({ ...form, isTemporary: e.target.checked })}
        />
        Temporary assignment (auto-expires on end date)
      </label>
      <button
        type="button"
        className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
        onClick={() => save.mutate()}
        disabled={!form.studentId || !form.routeId}
      >
        Assign student
      </button>
      {save.isError ? (
        <p className="text-sm text-rose-600">{(save.error as Error).message}</p>
      ) : null}
      <div className="overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2 text-left">Route</th>
              <th className="px-3 py-2 text-left">Stop</th>
              <th className="px-3 py-2 text-left">Mode</th>
              <th className="px-3 py-2 text-left">From</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {(list.data?.items ?? []).map((a: any) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2">{a.student?.fullName}</td>
                <td className="px-3 py-2">{a.route?.name}</td>
                <td className="px-3 py-2">{a.pickupStop?.name}</td>
                <td className="px-3 py-2">
                  <Badge value={a.tripMode} />
                </td>
                <td className="px-3 py-2">{String(a.validFrom).slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <button type="button" className="text-rose-600" onClick={() => setConfirm(a.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirm ? (
        <ConfirmBar
          title="Remove student from route?"
          body="Historical allocation dates stay intact. This ends the current assignment only."
          confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            end.mutate(confirm);
            setConfirm(null);
          }}
        />
      ) : null}
    </TransportShell>
  );
}

export function TransportTripsDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [confirm, setConfirm] = useState<{ kind: string; id: string } | null>(null);
  const trips = useQuery({
    queryKey: ['tr-trips', today],
    queryFn: () => fetchTransportTrips({ date: today, limit: 50 }),
    enabled,
  });
  const [tripId, setTripId] = useState('');
  const roster = useQuery({
    queryKey: ['tr-roster', tripId],
    queryFn: () => fetchTransportRoster(tripId),
    enabled: enabled && Boolean(tripId),
  });
  const gen = useMutation({
    mutationFn: () => generateTransportTrips({ date: today }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-trips'] }),
  });
  return (
    <TransportShell
      title="Trips & Attendance"
      extra={
        <button
          type="button"
          className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
          onClick={() => gen.mutate()}
        >
          Generate today
        </button>
      }
    >
      {gen.isError ? <p className="text-sm text-rose-600">{(gen.error as Error).message}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(trips.data?.items ?? []).map((t: any) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTripId(t.id)}
            className={`rounded-xl border bg-white p-4 text-left ${tripId === t.id ? 'border-[#2563eb]' : ''}`}
          >
            <p className="font-semibold">
              {t.route?.name} · {t.tripType}
            </p>
            <p className="text-sm text-slate-500">
              {t.vehicle?.registrationNumber} · {t.driver?.fullName}
            </p>
            <Badge value={t.status} />
          </button>
        ))}
      </div>
      {roster.data ? (
        <div className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
              onClick={() => setConfirm({ kind: 'start', id: tripId })}
            >
              Start trip
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setConfirm({ kind: 'complete', id: tripId })}
            >
              Complete trip
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setConfirm({ kind: 'bulk-board', id: tripId })}
            >
              Mark all boarded
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setConfirm({ kind: 'bulk-absent', id: tripId })}
            >
              Mark all absent
            </button>
          </div>
          <table className="mt-3 min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-1">#</th>
                <th>Student</th>
                <th>Stop</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(roster.data.students ?? []).map((s: any) => (
                <tr key={s.student.id} className="border-t">
                  <td className="py-2">{s.index}</td>
                  <td>{s.student.fullName}</td>
                  <td>{s.stop?.name}</td>
                  <td>
                    <Badge value={s.status} />
                  </td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      className="text-[#2563eb]"
                      onClick={() =>
                        transportBoarding(tripId, {
                          studentId: s.student.id,
                          eventType: 'BOARDED',
                          stopId: s.stop?.id,
                        }).then(() => qc.invalidateQueries({ queryKey: ['tr-roster', tripId] }))
                      }
                    >
                      Boarded
                    </button>
                    <button
                      type="button"
                      className="text-slate-600"
                      onClick={() =>
                        transportBoarding(tripId, {
                          studentId: s.student.id,
                          eventType: 'ABSENT',
                        }).then(() => qc.invalidateQueries({ queryKey: ['tr-roster', tripId] }))
                      }
                    >
                      Absent
                    </button>
                    <button
                      type="button"
                      className="text-emerald-700"
                      onClick={() =>
                        transportBoarding(tripId, {
                          studentId: s.student.id,
                          eventType: 'DROPPED',
                          stopId: s.stop?.id,
                        }).then(() => qc.invalidateQueries({ queryKey: ['tr-roster', tripId] }))
                      }
                    >
                      Dropped
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {confirm ? (
        <ConfirmBar
          title={
            confirm.kind.includes('bulk')
              ? 'Confirm bulk attendance?'
              : confirm.kind === 'start'
                ? 'Start trip?'
                : 'Complete trip?'
          }
          body="This updates live attendance and may notify parents according to school settings."
          confirmLabel="Confirm"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.kind === 'start') await transportTripAction(confirm.id, 'start');
            if (confirm.kind === 'complete') await transportTripAction(confirm.id, 'complete');
            if (confirm.kind === 'bulk-board')
              await transportBulkAttendance(confirm.id, { eventType: 'BOARDED', confirm: true });
            if (confirm.kind === 'bulk-absent')
              await transportBulkAttendance(confirm.id, { eventType: 'ABSENT', confirm: true });
            setConfirm(null);
            qc.invalidateQueries({ queryKey: ['tr-trips'] });
            qc.invalidateQueries({ queryKey: ['tr-roster'] });
          }}
        />
      ) : null}
    </TransportShell>
  );
}

export function TransportTrackingDesk() {
  const enabled = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['tr-track'],
    queryFn: fetchTransportTracking,
    enabled,
    refetchInterval: 15000,
  });
  return (
    <TransportShell title="Live Tracking">
      {!q.data?.gpsEnabled ? (
        <p className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">
          GPS is optional. Fleet lists, trips and attendance work without hardware. Enable GPS in
          Transport Settings when ready.
        </p>
      ) : null}
      <p className="text-xs text-slate-500">
        Map provider abstraction: {q.data?.map?.provider}. API keys stay in environment variables.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {(q.data?.vehicles ?? []).map((v: any) => (
          <div key={v.id} className="rounded-xl border bg-white p-4">
            <div className="flex justify-between">
              <h2 className="font-semibold">{v.registrationNumber}</h2>
              <Badge value={v.status} />
            </div>
            <p className="text-sm text-slate-600">
              {v.route ?? 'No route'} · Driver {v.driver ?? '—'}
            </p>
            <p className="text-sm">
              Speed {v.speedKmh ?? '—'} km/h · {v.stale ? 'Stale GPS' : 'Live'}
            </p>
            {v.eta ? (
              <p className="mt-1 text-sm text-slate-500">
                Next stop {v.eta.nextStop} · ETA {v.eta.minutes} min (estimated)
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </TransportShell>
  );
}

export function TransportIncidentsDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [form, setForm] = useState({ kind: 'BREAKDOWN', severity: 'MEDIUM', description: '' });
  const [confirm, setConfirm] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['tr-inc'], queryFn: fetchTransportIncidents, enabled });
  const save = useMutation({
    mutationFn: () => saveTransportIncident(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-inc'] }),
  });
  return (
    <TransportShell title="Incidents & SOS">
      <div className="grid gap-3 md:grid-cols-4">
        <select
          className={fieldClass}
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value })}
        >
          {[
            'ACCIDENT',
            'BREAKDOWN',
            'MEDICAL',
            'STUDENT',
            'DRIVER',
            'BLOCKAGE',
            'TRAFFIC',
            'OTHER',
          ].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={form.severity}
          onChange={(e) => setForm({ ...form, severity: e.target.value })}
        >
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input
          className={`${fieldClass} md:col-span-2`}
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <button
        type="button"
        className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
        onClick={() => save.mutate()}
      >
        Record incident
      </button>
      <div className="space-y-2">
        {(q.data ?? []).map((i: any) => (
          <div key={i.id} className="rounded-xl border bg-white p-4">
            <div className="flex justify-between">
              <p className="font-semibold">
                {i.incidentNo} · {i.kind}
              </p>
              <Badge value={i.severity} />
            </div>
            <p className="text-sm text-slate-600">{i.description}</p>
            {i.status !== 'RESOLVED' ? (
              <button
                type="button"
                className="mt-2 text-sm text-[#2563eb]"
                onClick={() => setConfirm(i.id)}
              >
                Resolve
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {confirm ? (
        <ConfirmBar
          title="Resolve incident?"
          body="This is recorded in the immutable audit log."
          confirmLabel="Resolve"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            resolveTransportIncident(confirm).then(() =>
              qc.invalidateQueries({ queryKey: ['tr-inc'] }),
            );
            setConfirm(null);
          }}
        />
      ) : null}
    </TransportShell>
  );
}

export function TransportMaintenanceDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const vehicles = useQuery({
    queryKey: ['tr-veh'],
    queryFn: () => fetchTransportVehicles({ limit: 50 }),
    enabled,
  });
  const list = useQuery({
    queryKey: ['tr-maint'],
    queryFn: () => fetchTransportMaintenance(),
    enabled,
  });
  const [form, setForm] = useState({
    vehicleId: '',
    date: new Date().toISOString().slice(0, 10),
    serviceType: 'SCHEDULED',
    cost: '0',
    description: '',
  });
  const save = useMutation({
    mutationFn: () => saveTransportMaintenance({ ...form, cost: Number(form.cost || 0) * 100 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-maint'] }),
  });
  return (
    <TransportShell title="Maintenance">
      <div className="grid gap-3 md:grid-cols-4">
        <select
          className={fieldClass}
          value={form.vehicleId}
          onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
        >
          <option value="">Vehicle</option>
          {(vehicles.data?.items ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.registrationNumber}
            </option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={form.serviceType}
          onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
        >
          {[
            'SCHEDULED',
            'OIL',
            'BRAKE',
            'TYRE',
            'BATTERY',
            'ENGINE',
            'ELECTRICAL',
            'AC',
            'BODY',
            'EMERGENCY',
            'OTHER',
          ].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input
          className={fieldClass}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Cost ₹"
          value={form.cost}
          onChange={(e) => setForm({ ...form, cost: e.target.value })}
        />
      </div>
      <button
        type="button"
        className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
        onClick={() => save.mutate()}
      >
        Save
      </button>
      <ul className="space-y-2 text-sm">
        {(list.data ?? []).map((m: any) => (
          <li key={m.id} className="rounded-xl border bg-white p-3">
            {m.vehicle?.registrationNumber} · {m.serviceType} · ₹{(m.cost / 100).toFixed(0)}
          </li>
        ))}
      </ul>
    </TransportShell>
  );
}

export function TransportFuelDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const vehicles = useQuery({
    queryKey: ['tr-veh'],
    queryFn: () => fetchTransportVehicles({ limit: 50 }),
    enabled,
  });
  const list = useQuery({ queryKey: ['tr-fuel'], queryFn: () => fetchTransportFuel(), enabled });
  const [form, setForm] = useState({
    vehicleId: '',
    date: new Date().toISOString().slice(0, 10),
    odometer: '0',
    litres: '0',
    rate: '0',
  });
  const save = useMutation({
    mutationFn: () =>
      saveTransportFuel({
        ...form,
        odometer: Number(form.odometer),
        litres: Number(form.litres),
        rate: Number(form.rate) * 100,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-fuel'] }),
  });
  return (
    <TransportShell title="Fuel">
      <div className="grid gap-3 md:grid-cols-5">
        <select
          className={fieldClass}
          value={form.vehicleId}
          onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
        >
          <option value="">Vehicle</option>
          {(vehicles.data?.items ?? []).map((v: any) => (
            <option key={v.id} value={v.id}>
              {v.registrationNumber}
            </option>
          ))}
        </select>
        <input
          className={fieldClass}
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Odometer"
          value={form.odometer}
          onChange={(e) => setForm({ ...form, odometer: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Litres"
          value={form.litres}
          onChange={(e) => setForm({ ...form, litres: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="₹ / litre"
          value={form.rate}
          onChange={(e) => setForm({ ...form, rate: e.target.value })}
        />
      </div>
      <button
        type="button"
        className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
        onClick={() => save.mutate()}
      >
        Save
      </button>
      <ul className="space-y-2 text-sm">
        {(list.data ?? []).map((f: any) => (
          <li key={f.id} className="rounded-xl border bg-white p-3">
            {f.vehicle?.registrationNumber} · {String(f.litres)} L · ₹
            {(f.totalAmount / 100).toFixed(0)}
          </li>
        ))}
      </ul>
    </TransportShell>
  );
}

export function TransportFeesDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tr-fees'], queryFn: fetchTransportFeePlans, enabled });
  const [form, setForm] = useState({
    name: '',
    amount: '800',
    cadence: 'MONTHLY',
    pricingModel: 'ROUTE',
  });
  const save = useMutation({
    mutationFn: () => saveTransportFeePlan({ ...form, amount: Number(form.amount) * 100 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-fees'] }),
  });
  return (
    <TransportShell title="Transport Fees">
      <p className="text-sm text-slate-500">
        Amounts are school-configured. Historical fee assignments do not change when a plan is
        edited later.
      </p>
      <div className="grid gap-3 md:grid-cols-4">
        <input
          className={fieldClass}
          placeholder="Plan name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="₹ amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <select
          className={fieldClass}
          value={form.cadence}
          onChange={(e) => setForm({ ...form, cadence: e.target.value })}
        >
          {['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'CUSTOM'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className={fieldClass}
          value={form.pricingModel}
          onChange={(e) => setForm({ ...form, pricingModel: e.target.value })}
        >
          {['ROUTE', 'ZONE', 'DISTANCE', 'CLASS'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
        onClick={() => save.mutate()}
      >
        Save plan
      </button>
      <ul className="space-y-2">
        {(q.data ?? []).map((p: any) => (
          <li key={p.id} className="rounded-xl border bg-white p-3 text-sm">
            {p.name} · ₹{(p.amount / 100).toFixed(0)} / {p.cadence}
          </li>
        ))}
      </ul>
    </TransportShell>
  );
}

export function TransportRequestsDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tr-req'], queryFn: () => fetchTransportRequests(), enabled });
  return (
    <TransportShell title="Transport Requests">
      <ul className="space-y-2">
        {(q.data ?? []).map((r: any) => (
          <li key={r.id} className="rounded-xl border bg-white p-4">
            <p className="font-medium">
              {r.student?.fullName} · {r.kind}
            </p>
            <p className="text-sm text-slate-500">{r.reason}</p>
            <Badge value={r.status} />
            {r.status === 'PENDING' ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="text-emerald-700"
                  onClick={() =>
                    reviewTransportRequest(r.id, { status: 'APPROVED' }).then(() =>
                      qc.invalidateQueries({ queryKey: ['tr-req'] }),
                    )
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="text-rose-700"
                  onClick={() =>
                    reviewTransportRequest(r.id, { status: 'REJECTED' }).then(() =>
                      qc.invalidateQueries({ queryKey: ['tr-req'] }),
                    )
                  }
                >
                  Reject
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </TransportShell>
  );
}

export function TransportSettingsDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['tr-set'], queryFn: fetchTransportSettings, enabled });
  const policy = q.data?.policy ?? {};
  const [form, setForm] = useState<Record<string, unknown>>({});
  const merged = useMemo(
    () => ({ ...q.data, ...form, policy: { ...policy, ...(form.policy as object) } }),
    [q.data, form, policy],
  );
  const save = useMutation({
    mutationFn: () =>
      saveTransportSettings({
        gpsEnabled: merged.gpsEnabled,
        mapProvider: merged.mapProvider,
        notifySms: merged.notifySms,
        notifyWhatsapp: merged.notifyWhatsapp,
        notifyPush: merged.notifyPush,
        allowCapacityOverride: merged.allowCapacityOverride,
        blockExpiredDriver: merged.blockExpiredDriver,
        geofenceDefaultMeters: Number(merged.geofenceDefaultMeters ?? 100),
        policyJson: merged.policy,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tr-set'] }),
  });
  if (!q.data)
    return (
      <TransportShell title="Settings">
        {q.isLoading ? 'Loading…' : 'Unable to load'}
      </TransportShell>
    );
  return (
    <TransportShell title="Transport Settings">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(merged.gpsEnabled)}
            onChange={(e) => setForm({ ...form, gpsEnabled: e.target.checked })}
          />{' '}
          Enable GPS
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(merged.notifySms)}
            onChange={(e) => setForm({ ...form, notifySms: e.target.checked })}
          />{' '}
          SMS notifications
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(merged.notifyWhatsapp)}
            onChange={(e) => setForm({ ...form, notifyWhatsapp: e.target.checked })}
          />{' '}
          WhatsApp notifications
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(merged.blockExpiredDriver)}
            onChange={(e) => setForm({ ...form, blockExpiredDriver: e.target.checked })}
          />{' '}
          Block expired licences
        </label>
        <label className="text-sm">
          Map provider
          <select
            className={`${fieldClass} mt-1`}
            value={String(merged.mapProvider ?? 'OSM')}
            onChange={(e) => setForm({ ...form, mapProvider: e.target.value })}
          >
            <option value="OSM">OpenStreetMap</option>
            <option value="GOOGLE">Google Maps</option>
            <option value="MAPBOX">Mapbox</option>
            <option value="NONE">None</option>
          </select>
        </label>
        <label className="text-sm">
          Document expiry warning (days)
          <select
            className={`${fieldClass} mt-1`}
            value={String((merged.policy as any)?.documentExpiryDays ?? 30)}
            onChange={(e) =>
              setForm({
                ...form,
                policy: {
                  ...(merged.policy as object),
                  documentExpiryDays: Number(e.target.value),
                },
              })
            }
          >
            {[7, 15, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          GPS interval (seconds)
          <input
            className={`${fieldClass} mt-1`}
            value={String((merged.policy as any)?.gpsIntervalSeconds ?? 20)}
            onChange={(e) =>
              setForm({
                ...form,
                policy: {
                  ...(merged.policy as object),
                  gpsIntervalSeconds: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label className="text-sm">
          Geofence radius (m)
          <input
            className={`${fieldClass} mt-1`}
            value={String(merged.geofenceDefaultMeters ?? 100)}
            onChange={(e) => setForm({ ...form, geofenceDefaultMeters: Number(e.target.value) })}
          />
        </label>
      </div>
      <button
        type="button"
        className="rounded-lg bg-[#2563eb] px-3 py-2 text-sm text-white"
        onClick={() => save.mutate()}
      >
        Save settings
      </button>
    </TransportShell>
  );
}

export function TransportDesk({ view }: { view: View }) {
  const map = {
    dashboard: <TransportDashboardDesk />,
    vehicles: <TransportVehiclesDesk />,
    routes: <TransportRoutesDesk />,
    stops: <TransportStopsDesk />,
    drivers: <TransportDriversDesk />,
    attendants: <TransportAttendantsDesk />,
    allocations: <TransportAllocationsDesk />,
    trips: <TransportTripsDesk />,
    tracking: <TransportTrackingDesk />,
    incidents: <TransportIncidentsDesk />,
    maintenance: <TransportMaintenanceDesk />,
    fuel: <TransportFuelDesk />,
    fees: <TransportFeesDesk />,
    requests: <TransportRequestsDesk />,
    settings: <TransportSettingsDesk />,
  };
  return map[view];
}
