'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Building2,
  CalendarDays,
  Copy,
  DoorOpen,
  Download,
  Edit3,
  Eye,
  FlaskConical,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  activateInfrastructureBuilding,
  activateInfrastructureFloor,
  activateInfrastructureRoom,
  archiveInfrastructureBuilding,
  archiveInfrastructureFloor,
  archiveInfrastructureRoom,
  bulkInfrastructureRooms,
  commitInfrastructureImport,
  createInfrastructureBuilding,
  createInfrastructureFloor,
  createInfrastructureReservation,
  createInfrastructureRoom,
  deleteInfrastructureBuilding,
  deleteInfrastructureFloor,
  deleteInfrastructureRoom,
  downloadInfrastructureExport,
  downloadInfrastructureTemplate,
  fetchInfrastructureAvailability,
  fetchInfrastructureBuildings,
  fetchInfrastructureDashboard,
  fetchInfrastructureFloors,
  fetchInfrastructureLabs,
  fetchInfrastructureReport,
  fetchInfrastructureReservations,
  fetchInfrastructureRooms,
  fetchInfrastructureRoomTypes,
  fetchInfrastructureSharedHalls,
  seedInfrastructureRoomTypes,
  updateInfrastructureBuilding,
  updateInfrastructureFloor,
  updateInfrastructureReservationStatus,
  updateInfrastructureRoom,
  validateInfrastructureImport,
  type InfrastructureBuilding,
  type InfrastructureFloor,
  type InfrastructureReservation,
  type InfrastructureRoom,
  type RoomPayload,
} from '@/services/infrastructure';
import { fetchCampuses } from '@/services/organization';
import { cn } from '@/utils/cn';

type PageKey =
  | 'dashboard'
  | 'buildings'
  | 'floors'
  | 'rooms'
  | 'labs'
  | 'shared-halls'
  | 'calendar'
  | 'availability'
  | 'import-export'
  | 'reports'
  | 'settings';

type Mode = 'view' | 'edit';

const tabs: Array<{ key: PageKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'floors', label: 'Floors' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'labs', label: 'Labs' },
  { key: 'shared-halls', label: 'Shared Halls' },
  { key: 'calendar', label: 'Room Calendar' },
  { key: 'availability', label: 'Availability' },
  { key: 'import-export', label: 'Import / Export' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
];

const statuses = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'BLOCKED', 'RESERVED', 'ARCHIVED'];

export function InfrastructureWorkspace({ page = 'dashboard' }: { page?: PageKey }) {
  const [active, setActive] = useState<PageKey>(page);
  const dashboard = useQuery({
    queryKey: ['infrastructure', 'dashboard'],
    queryFn: fetchInfrastructureDashboard,
  });

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Organization Infrastructure
            </p>
            <h1 className="mt-1 text-2xl font-bold">Infrastructure & Room Management</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Central room, lab, shared hall, capacity, availability, booking, and timetable-ready
              infrastructure master.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right text-xs">
            <Kpi label="Rooms" value={dashboard.data?.totalRooms ?? 0} />
            <Kpi label="Labs" value={dashboard.data?.labs ?? 0} />
          </div>
        </div>
      </section>

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              'shrink-0 rounded-xl px-3 py-2 text-xs font-medium',
              active === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {active === 'dashboard' ? <DashboardPanel data={dashboard.data} /> : null}
      {active === 'rooms' ? <RoomsPanel /> : null}
      {active === 'buildings' ? <BuildingsPanel /> : null}
      {active === 'floors' ? <FloorsPanel /> : null}
      {active === 'labs' ? <RoomsPanel mode="labs" /> : null}
      {active === 'shared-halls' ? <RoomsPanel mode="shared-halls" /> : null}
      {active === 'calendar' || active === 'availability' ? <AvailabilityPanel /> : null}
      {active === 'import-export' ? <ImportExportPanel /> : null}
      {active === 'reports' ? <ReportsPanel /> : null}
      {active === 'settings' ? <SettingsPanel /> : null}
    </div>
  );
}

function DashboardPanel({ data }: { data: any }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Metric icon={<DoorOpen />} label="Total Rooms" value={data?.totalRooms ?? 0} />
      <Metric icon={<FlaskConical />} label="Labs" value={data?.labs ?? 0} />
      <Metric icon={<Building2 />} label="Shared Halls" value={data?.sharedHalls ?? 0} />
      <Metric
        icon={<CalendarDays />}
        label="Reservations"
        value={data?.upcomingReservations ?? 0}
      />
      <Metric label="Active Rooms" value={data?.activeRooms ?? 0} />
      <Metric label="Maintenance" value={data?.underMaintenance ?? 0} />
      <Metric label="Utilization" value={`${data?.utilizationRate ?? 0}%`} />
      <Metric label="Classrooms" value={data?.classrooms ?? 0} />
    </div>
  );
}

function RoomsPanel({ mode }: { mode?: 'labs' | 'shared-halls' }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    buildingId: '',
    floorId: '',
    roomTypeId: '',
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<{ mode: Mode; room: Partial<InfrastructureRoom> } | null>(
    null,
  );
  const title = mode === 'labs' ? 'Labs' : mode === 'shared-halls' ? 'Shared Halls' : 'Room Master';
  const queryParams = {
    search: filters.search || undefined,
    status: filters.status || undefined,
    buildingId: filters.buildingId || undefined,
    floorId: filters.floorId || undefined,
    roomTypeId: filters.roomTypeId || undefined,
  };
  const rooms = useQuery({
    queryKey: ['infrastructure', mode ?? 'rooms', queryParams],
    queryFn: () =>
      mode === 'labs'
        ? fetchInfrastructureLabs()
        : mode === 'shared-halls'
          ? fetchInfrastructureSharedHalls()
          : fetchInfrastructureRooms(queryParams),
  });
  const buildings = useQuery({
    queryKey: ['infrastructure', 'buildings', 'ALL'],
    queryFn: () => fetchInfrastructureBuildings({ status: 'ALL' }),
  });
  const floors = useQuery({
    queryKey: ['infrastructure', 'floors', filters.buildingId || 'ALL'],
    queryFn: () =>
      fetchInfrastructureFloors({ buildingId: filters.buildingId || undefined, status: 'ALL' }),
  });
  const roomTypes = useQuery({
    queryKey: ['infrastructure', 'room-types'],
    queryFn: fetchInfrastructureRoomTypes,
  });
  const campuses = useQuery({
    queryKey: ['organization', 'campuses'],
    queryFn: () => fetchCampuses(),
  });

  const saveMut = useMutation({
    mutationFn: (payload: Partial<InfrastructureRoom>) => {
      const prepared = prepareRoomPayload(payload, mode);
      return payload.id
        ? updateInfrastructureRoom(payload.id, prepared)
        : createInfrastructureRoom(prepared as RoomPayload);
    },
    onSuccess: () => {
      setModal(null);
      qc.invalidateQueries({ queryKey: ['infrastructure'] });
    },
    onError: showApiError,
  });
  const archiveMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? archiveInfrastructureRoom(id) : activateInfrastructureRoom(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure'] }),
    onError: showApiError,
  });
  const deleteMut = useMutation({
    mutationFn: deleteInfrastructureRoom,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure'] }),
    onError: showApiError,
  });
  const bulkMut = useMutation({
    mutationFn: bulkInfrastructureRooms,
    onSuccess: () => {
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['infrastructure'] });
    },
    onError: showApiError,
  });

  const rows = rooms.data ?? [];
  const selectedRows = rows.filter((row) => selected.includes(row.id));

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            Full master actions: view, edit, duplicate, archive, safe delete, filters, and bulk
            operations.
          </p>
        </div>
        <Button size="sm" onClick={() => setModal({ mode: 'edit', room: defaultRoom(mode) })}>
          <Plus className="mr-2 h-4 w-4" />
          Add {mode === 'labs' ? 'Lab' : mode === 'shared-halls' ? 'Hall' : 'Room'}
        </Button>
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-5">
        <SearchBox
          value={filters.search}
          onChange={(search) => setFilters((prev) => ({ ...prev, search }))}
        />
        <Select
          value={filters.status}
          onChange={(status) => setFilters((prev) => ({ ...prev, status }))}
        >
          <option value="">Active records</option>
          <option value="ALL">All records</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <Select
          value={filters.buildingId}
          onChange={(buildingId) => setFilters((prev) => ({ ...prev, buildingId, floorId: '' }))}
        >
          <option value="">All buildings</option>
          {(buildings.data ?? []).map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.floorId}
          onChange={(floorId) => setFilters((prev) => ({ ...prev, floorId }))}
        >
          <option value="">All floors</option>
          {(floors.data ?? []).map((floor) => (
            <option key={floor.id} value={floor.id}>
              {floor.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.roomTypeId}
          onChange={(roomTypeId) => setFilters((prev) => ({ ...prev, roomTypeId }))}
        >
          <option value="">All types</option>
          {(roomTypes.data ?? []).map((type: any) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs">
        <span className="font-semibold">{selected.length} selected</span>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.length}
          onClick={() => bulkMut.mutate({ ids: selected, action: 'ARCHIVE' })}
        >
          Bulk Archive
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.length}
          onClick={() => bulkMut.mutate({ ids: selected, action: 'ACTIVATE' })}
        >
          Bulk Activate
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.length}
          onClick={() =>
            confirmDeleteMany(selectedRows) && bulkMut.mutate({ ids: selected, action: 'DELETE' })
          }
        >
          Bulk Delete
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!selected.length}
          onClick={() => exportSelectedRooms(selectedRows)}
        >
          Bulk Export
        </Button>
      </div>

      <RoomGrid
        rooms={rows}
        buildings={buildings.data ?? []}
        floors={floors.data ?? []}
        loading={rooms.isLoading}
        selected={selected}
        onSelect={(id, checked) =>
          setSelected((prev) => (checked ? [...prev, id] : prev.filter((value) => value !== id)))
        }
        onView={(room) => setModal({ mode: 'view', room })}
        onEdit={(room) => setModal({ mode: 'edit', room })}
        onDuplicate={(room) => setModal({ mode: 'edit', room: duplicateRoom(room) })}
        onArchive={(room) => archiveMut.mutate({ id: room.id, active: room.status !== 'ARCHIVED' })}
        onDelete={(room) => confirmDelete(room) && deleteMut.mutate(room.id)}
      />

      {modal ? (
        <RoomModal
          mode={modal.mode}
          room={modal.room}
          campuses={campuses.data ?? []}
          buildings={buildings.data ?? []}
          floors={floors.data ?? []}
          roomTypes={roomTypes.data ?? []}
          saving={saveMut.isPending}
          onClose={() => setModal(null)}
          onSave={(room) => saveMut.mutate(room)}
        />
      ) : null}
    </section>
  );
}

function RoomGrid({
  rooms,
  buildings,
  floors,
  loading,
  selected,
  onSelect,
  onView,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  rooms: InfrastructureRoom[];
  buildings: InfrastructureBuilding[];
  floors: InfrastructureFloor[];
  loading: boolean;
  selected: string[];
  onSelect: (id: string, checked: boolean) => void;
  onView: (room: InfrastructureRoom) => void;
  onEdit: (room: InfrastructureRoom) => void;
  onDuplicate: (room: InfrastructureRoom) => void;
  onArchive: (room: InfrastructureRoom) => void;
  onDelete: (room: InfrastructureRoom) => void;
}) {
  if (loading) return <Loading label="Loading rooms..." />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rooms.map((room) => {
        const building = buildings.find((row) => row.id === room.buildingId);
        const floor = floors.find((row) => row.id === room.floorId);
        return (
          <div
            key={room.id}
            className="rounded-2xl border border-border/60 p-3 transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(room.id)}
                  onChange={(event) => onSelect(room.id, event.target.checked)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold">{room.code}</p>
                  <p className="text-sm">{room.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {room.roomType?.name ?? 'Room'} · Capacity {room.capacity}
                    {building ? ` · ${building.name}` : ''}
                    {floor ? ` · ${floor.name}` : ''}
                  </p>
                </div>
              </div>
              <StatusBadge status={room.status ?? 'ACTIVE'} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {room.isPracticalLab ? <Badge>Lab</Badge> : null}
              {room.isSharedHall ? <Badge>Shared Hall</Badge> : null}
              {room.availableForExams ? <Badge>Exam</Badge> : null}
              {(room.shiftAvailability ?? []).slice(0, 2).map((shift) => (
                <Badge key={shift}>{shift}</Badge>
              ))}
              {(room.facilities ?? []).slice(0, 3).map((facility) => (
                <Badge key={facility}>{facility}</Badge>
              ))}
            </div>
            <ActionBar
              archived={room.status === 'ARCHIVED'}
              onView={() => onView(room)}
              onEdit={() => onEdit(room)}
              onDuplicate={() => onDuplicate(room)}
              onArchive={() => onArchive(room)}
              onDelete={() => onDelete(room)}
            />
          </div>
        );
      })}
      {!rooms.length ? <p className="text-sm text-muted-foreground">No records found.</p> : null}
    </div>
  );
}

function BuildingsPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<{ mode: Mode; row: Partial<InfrastructureBuilding> } | null>(
    null,
  );
  const campuses = useQuery({
    queryKey: ['organization', 'campuses'],
    queryFn: () => fetchCampuses(),
  });
  const buildings = useQuery({
    queryKey: ['infrastructure', 'buildings', status],
    queryFn: () => fetchInfrastructureBuildings({ status: status || undefined }),
  });
  const saveMut = useMutation({
    mutationFn: (row: Partial<InfrastructureBuilding>) =>
      row.id
        ? updateInfrastructureBuilding(row.id, row)
        : createInfrastructureBuilding({
            code: row.code ?? '',
            name: row.name ?? '',
            campusId: row.campusId ?? undefined,
            description: row.description ?? undefined,
            status: row.status ?? 'ACTIVE',
          }),
    onSuccess: () => {
      setModal(null);
      qc.invalidateQueries({ queryKey: ['infrastructure', 'buildings'] });
    },
    onError: showApiError,
  });
  const archiveMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? archiveInfrastructureBuilding(id) : activateInfrastructureBuilding(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure', 'buildings'] }),
    onError: showApiError,
  });
  const deleteMut = useMutation({
    mutationFn: deleteInfrastructureBuilding,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure', 'buildings'] }),
    onError: showApiError,
  });

  return (
    <MasterPanel
      title="Buildings"
      subtitle="Campus linked building master with consistent CRUD actions."
      status={status}
      onStatusChange={setStatus}
      onAdd={() => setModal({ mode: 'edit', row: { code: '', name: '', status: 'ACTIVE' } })}
    >
      <MasterRows
        rows={buildings.data ?? []}
        loading={buildings.isLoading}
        primary={(row) => `${row.code} · ${row.name}`}
        secondary={(row) =>
          `${campuses.data?.find((campus) => campus.id === row.campusId)?.name ?? 'No campus'} · ${row.status}`
        }
        onView={(row) => setModal({ mode: 'view', row })}
        onEdit={(row) => setModal({ mode: 'edit', row })}
        onDuplicate={(row) =>
          setModal({
            mode: 'edit',
            row: { ...row, id: undefined, code: `${row.code}-COPY`, name: `${row.name} Copy` },
          })
        }
        onArchive={(row) => archiveMut.mutate({ id: row.id, active: row.status !== 'ARCHIVED' })}
        onDelete={(row) => confirmDelete(row) && deleteMut.mutate(row.id)}
      />
      {modal ? (
        <BuildingModal
          mode={modal.mode}
          row={modal.row}
          campuses={campuses.data ?? []}
          saving={saveMut.isPending}
          onClose={() => setModal(null)}
          onSave={(row) => saveMut.mutate(row)}
        />
      ) : null}
    </MasterPanel>
  );
}

function FloorsPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState<{ mode: Mode; row: Partial<InfrastructureFloor> } | null>(
    null,
  );
  const buildings = useQuery({
    queryKey: ['infrastructure', 'buildings', 'ALL'],
    queryFn: () => fetchInfrastructureBuildings({ status: 'ALL' }),
  });
  const floors = useQuery({
    queryKey: ['infrastructure', 'floors', status],
    queryFn: () => fetchInfrastructureFloors({ status: status || undefined }),
  });
  const saveMut = useMutation({
    mutationFn: (row: Partial<InfrastructureFloor>) =>
      row.id
        ? updateInfrastructureFloor(row.id, row)
        : createInfrastructureFloor({
            buildingId: row.buildingId ?? '',
            name: row.name ?? '',
            floorNumber: row.floorNumber ?? undefined,
            description: row.description ?? undefined,
            status: row.status ?? 'ACTIVE',
          }),
    onSuccess: () => {
      setModal(null);
      qc.invalidateQueries({ queryKey: ['infrastructure', 'floors'] });
    },
    onError: showApiError,
  });
  const archiveMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? archiveInfrastructureFloor(id) : activateInfrastructureFloor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure', 'floors'] }),
    onError: showApiError,
  });
  const deleteMut = useMutation({
    mutationFn: deleteInfrastructureFloor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure', 'floors'] }),
    onError: showApiError,
  });

  return (
    <MasterPanel
      title="Floors"
      subtitle="Building linked floor master with validation to prevent missing building 500 errors."
      status={status}
      onStatusChange={setStatus}
      onAdd={() =>
        setModal({
          mode: 'edit',
          row: { buildingId: buildings.data?.[0]?.id ?? '', name: '', status: 'ACTIVE' },
        })
      }
    >
      <MasterRows
        rows={floors.data ?? []}
        loading={floors.isLoading}
        primary={(row) => row.name}
        secondary={(row) =>
          `${buildings.data?.find((building) => building.id === row.buildingId)?.name ?? 'Building required'} · Floor ${row.floorNumber ?? '-'} · ${row.status}`
        }
        onView={(row) => setModal({ mode: 'view', row })}
        onEdit={(row) => setModal({ mode: 'edit', row })}
        onDuplicate={(row) =>
          setModal({ mode: 'edit', row: { ...row, id: undefined, name: `${row.name} Copy` } })
        }
        onArchive={(row) => archiveMut.mutate({ id: row.id, active: row.status !== 'ARCHIVED' })}
        onDelete={(row) => confirmDelete(row) && deleteMut.mutate(row.id)}
      />
      {modal ? (
        <FloorModal
          mode={modal.mode}
          row={modal.row}
          buildings={buildings.data ?? []}
          saving={saveMut.isPending}
          onClose={() => setModal(null)}
          onSave={(row) => saveMut.mutate(row)}
        />
      ) : null}
    </MasterPanel>
  );
}

function RoomModal({
  mode,
  room,
  campuses,
  buildings,
  floors,
  roomTypes,
  saving,
  onClose,
  onSave,
}: {
  mode: Mode;
  room: Partial<InfrastructureRoom>;
  campuses: Array<{ id: string; name: string }>;
  buildings: InfrastructureBuilding[];
  floors: InfrastructureFloor[];
  roomTypes: Array<{ id: string; name: string }>;
  saving: boolean;
  onClose: () => void;
  onSave: (room: Partial<InfrastructureRoom>) => void;
}) {
  const [form, setForm] = useState<Partial<InfrastructureRoom>>(room);
  const readonly = mode === 'view';
  const visibleFloors = floors.filter(
    (floor) => !form.buildingId || floor.buildingId === form.buildingId,
  );
  const update = (patch: Partial<InfrastructureRoom>) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <Modal title={readonly ? 'View Room' : form.id ? 'Edit Room' : 'Add Room'} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Room Code"
          value={form.code ?? ''}
          readonly={readonly}
          onChange={(code) => update({ code })}
        />
        <Field
          label="Room Name"
          value={form.name ?? ''}
          readonly={readonly}
          onChange={(name) => update({ name })}
        />
        <Field
          label="Short Name"
          value={form.shortName ?? ''}
          readonly={readonly}
          onChange={(shortName) => update({ shortName })}
        />
        <SelectField
          label="Campus"
          value={form.campusId ?? ''}
          readonly={readonly}
          onChange={(campusId) => update({ campusId })}
          options={campuses.map((campus) => ({ value: campus.id, label: campus.name }))}
        />
        <SelectField
          label="Building"
          value={form.buildingId ?? ''}
          readonly={readonly}
          onChange={(buildingId) => update({ buildingId, floorId: '' })}
          options={buildings.map((building) => ({ value: building.id, label: building.name }))}
        />
        <SelectField
          label="Floor"
          value={form.floorId ?? ''}
          readonly={readonly}
          onChange={(floorId) => update({ floorId })}
          options={visibleFloors.map((floor) => ({ value: floor.id, label: floor.name }))}
        />
        <SelectField
          label="Room Type"
          value={form.roomTypeId ?? form.roomType?.id ?? ''}
          readonly={readonly}
          onChange={(roomTypeId) => update({ roomTypeId } as any)}
          options={roomTypes.map((type) => ({ value: type.id, label: type.name }))}
        />
        <SelectField
          label="Status"
          value={form.status ?? 'ACTIVE'}
          readonly={readonly}
          onChange={(status) => update({ status })}
          options={statuses.map((status) => ({ value: status, label: status }))}
        />
        <NumberField
          label="Capacity"
          value={form.capacity ?? 40}
          readonly={readonly}
          onChange={(capacity) => update({ capacity })}
        />
        <NumberField
          label="Practical Capacity"
          value={form.practicalCapacity ?? ''}
          readonly={readonly}
          onChange={(practicalCapacity) => update({ practicalCapacity })}
        />
        <NumberField
          label="Exam Capacity"
          value={form.examCapacity ?? ''}
          readonly={readonly}
          onChange={(examCapacity) => update({ examCapacity })}
        />
        <NumberField
          label="Standing Capacity"
          value={form.standingCapacity ?? ''}
          readonly={readonly}
          onChange={(standingCapacity) => update({ standingCapacity })}
        />
        <Field
          label="Shift Availability"
          value={(form.shiftAvailability ?? []).join(', ')}
          readonly={readonly}
          onChange={(value) => update({ shiftAvailability: csv(value) })}
        />
        <Field
          label="Facilities"
          value={(form.facilities ?? []).join(', ')}
          readonly={readonly}
          onChange={(value) => update({ facilities: csv(value) })}
        />
        <SelectField
          label="Department Restriction"
          value={(form as any).departmentRestrictionMode ?? 'ALL'}
          readonly={readonly}
          onChange={(departmentRestrictionMode) => update({ departmentRestrictionMode } as any)}
          options={['ALL', 'ONLY', 'EXCLUDE'].map((value) => ({ value, label: value }))}
        />
        <Field
          label="Supported Categories"
          value={((form as any).supportedCategories ?? []).join(', ')}
          readonly={readonly}
          onChange={(value) => update({ supportedCategories: csv(value.toUpperCase()) } as any)}
        />
        <label className="md:col-span-2 text-xs font-medium">
          Description
          <textarea
            disabled={readonly}
            value={form.description ?? ''}
            onChange={(event) => update({ description: event.target.value })}
            className="mt-1 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none disabled:bg-muted"
          />
        </label>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {[
          ['isPracticalLab', 'Practical Lab'],
          ['isSharedHall', 'Shared Hall'],
          ['availableForTimetable', 'Timetable'],
          ['availableForAttendance', 'Attendance'],
          ['availableForExams', 'Exams'],
          ['availableForWorkshops', 'Workshops'],
          ['availableForSeminars', 'Seminars'],
          ['availableForCombined', 'Combined Class'],
          ['supportsMdc', 'MDC'],
          ['supportsVac', 'VAC'],
          ['supportsAec', 'AEC'],
          ['supportsSec', 'SEC'],
        ].map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs"
          >
            <input
              disabled={readonly}
              type="checkbox"
              checked={Boolean((form as any)[key])}
              onChange={(event) => update({ [key]: event.target.checked } as any)}
            />
            {label}
          </label>
        ))}
      </div>
      <ModalActions
        readonly={readonly}
        saving={saving}
        onClose={onClose}
        onSave={() => onSave(form)}
      />
    </Modal>
  );
}

function BuildingModal({
  mode,
  row,
  campuses,
  saving,
  onClose,
  onSave,
}: {
  mode: Mode;
  row: Partial<InfrastructureBuilding>;
  campuses: Array<{ id: string; name: string }>;
  saving: boolean;
  onClose: () => void;
  onSave: (row: Partial<InfrastructureBuilding>) => void;
}) {
  const [form, setForm] = useState(row);
  const readonly = mode === 'view';
  const update = (patch: Partial<InfrastructureBuilding>) =>
    setForm((prev) => ({ ...prev, ...patch }));
  return (
    <Modal
      title={readonly ? 'View Building' : form.id ? 'Edit Building' : 'Add Building'}
      onClose={onClose}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Building Code"
          value={form.code ?? ''}
          readonly={readonly}
          onChange={(code) => update({ code })}
        />
        <Field
          label="Building Name"
          value={form.name ?? ''}
          readonly={readonly}
          onChange={(name) => update({ name })}
        />
        <SelectField
          label="Campus"
          value={form.campusId ?? ''}
          readonly={readonly}
          onChange={(campusId) => update({ campusId })}
          options={campuses.map((campus) => ({ value: campus.id, label: campus.name }))}
        />
        <SelectField
          label="Status"
          value={form.status ?? 'ACTIVE'}
          readonly={readonly}
          onChange={(status) => update({ status })}
          options={statuses.map((status) => ({ value: status, label: status }))}
        />
        <label className="md:col-span-2 text-xs font-medium">
          Description
          <textarea
            disabled={readonly}
            value={form.description ?? ''}
            onChange={(event) => update({ description: event.target.value })}
            className="mt-1 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none disabled:bg-muted"
          />
        </label>
      </div>
      <ModalActions
        readonly={readonly}
        saving={saving}
        onClose={onClose}
        onSave={() => onSave(form)}
      />
    </Modal>
  );
}

function FloorModal({
  mode,
  row,
  buildings,
  saving,
  onClose,
  onSave,
}: {
  mode: Mode;
  row: Partial<InfrastructureFloor>;
  buildings: InfrastructureBuilding[];
  saving: boolean;
  onClose: () => void;
  onSave: (row: Partial<InfrastructureFloor>) => void;
}) {
  const [form, setForm] = useState(row);
  const readonly = mode === 'view';
  const update = (patch: Partial<InfrastructureFloor>) =>
    setForm((prev) => ({ ...prev, ...patch }));
  return (
    <Modal title={readonly ? 'View Floor' : form.id ? 'Edit Floor' : 'Add Floor'} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Floor Name"
          value={form.name ?? ''}
          readonly={readonly}
          onChange={(name) => update({ name })}
        />
        <NumberField
          label="Floor Number"
          value={form.floorNumber ?? ''}
          readonly={readonly}
          onChange={(floorNumber) => update({ floorNumber })}
        />
        <SelectField
          label="Building"
          value={form.buildingId ?? ''}
          readonly={readonly}
          onChange={(buildingId) => update({ buildingId })}
          options={buildings.map((building) => ({ value: building.id, label: building.name }))}
        />
        <SelectField
          label="Status"
          value={form.status ?? 'ACTIVE'}
          readonly={readonly}
          onChange={(status) => update({ status })}
          options={statuses.map((status) => ({ value: status, label: status }))}
        />
        <label className="md:col-span-2 text-xs font-medium">
          Description
          <textarea
            disabled={readonly}
            value={form.description ?? ''}
            onChange={(event) => update({ description: event.target.value })}
            className="mt-1 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none disabled:bg-muted"
          />
        </label>
      </div>
      <ModalActions
        readonly={readonly}
        saving={saving}
        onClose={onClose}
        onSave={() => onSave(form)}
      />
    </Modal>
  );
}

function MasterPanel({
  title,
  subtitle,
  status,
  onStatusChange,
  onAdd,
  children,
}: {
  title: string;
  subtitle: string;
  status: string;
  onStatusChange: (value: string) => void;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="mb-3 max-w-xs">
        <Select value={status} onChange={onStatusChange}>
          <option value="">Active records</option>
          <option value="ALL">All records</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </div>
      {children}
    </section>
  );
}

function MasterRows<T extends { id: string; status?: string }>({
  rows,
  loading,
  primary,
  secondary,
  onView,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  rows: T[];
  loading: boolean;
  primary: (row: T) => string;
  secondary: (row: T) => string;
  onView: (row: T) => void;
  onEdit: (row: T) => void;
  onDuplicate: (row: T) => void;
  onArchive: (row: T) => void;
  onDelete: (row: T) => void;
}) {
  if (loading) return <Loading label="Loading records..." />;
  return (
    <div className="overflow-auto rounded-2xl border border-border/60">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Record</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border/60">
              <td className="px-3 py-2">
                <p className="font-medium">{primary(row)}</p>
                <p className="text-xs text-muted-foreground">{secondary(row)}</p>
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={row.status ?? 'ACTIVE'} />
              </td>
              <td className="px-3 py-2">
                <ActionBar
                  compact
                  archived={row.status === 'ARCHIVED'}
                  onView={() => onView(row)}
                  onEdit={() => onEdit(row)}
                  onDuplicate={() => onDuplicate(row)}
                  onArchive={() => onArchive(row)}
                  onDelete={() => onDelete(row)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="p-4 text-sm text-muted-foreground">No records found.</p> : null}
    </div>
  );
}

function AvailabilityPanel() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [filters, setFilters] = useState({
    from: today,
    to: nextWeek,
    classroomId: '',
    status: '',
  });
  const rooms = useQuery({
    queryKey: ['infrastructure', 'rooms', 'calendar'],
    queryFn: () => fetchInfrastructureRooms({ status: 'ALL' }),
  });
  const availability = useQuery({
    queryKey: ['infrastructure', 'availability', filters.from, filters.to, filters.classroomId],
    queryFn: () =>
      fetchInfrastructureAvailability({
        from: startOfDayIso(filters.from),
        to: endOfDayIso(filters.to),
        classroomId: filters.classroomId || undefined,
      }),
  });
  const reservations = useQuery({
    queryKey: ['infrastructure', 'reservations', filters],
    queryFn: () =>
      fetchInfrastructureReservations({
        from: startOfDayIso(filters.from),
        to: endOfDayIso(filters.to),
        classroomId: filters.classroomId || undefined,
        status: filters.status || undefined,
      }),
  });
  const reserveMut = useMutation({
    mutationFn: createInfrastructureReservation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure'] }),
    onError: showApiError,
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateInfrastructureReservationStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure'] }),
    onError: showApiError,
  });
  const selectedRoom = rooms.data?.find((room) => room.id === filters.classroomId);
  const cards = availability.data?.roomCards ?? [];
  const days = useMemo(() => daysBetween(filters.from, filters.to), [filters.from, filters.to]);

  return (
    <section className="space-y-4 rounded-3xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Room Calendar & Availability</h2>
          <p className="text-xs text-muted-foreground">
            Reserve rooms, approve requests, and see free/reserved/timetable/maintenance states.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <Kpi label="Free" value={availability.data?.summary?.free ?? 0} />
          <Kpi label="Reserved" value={availability.data?.summary?.reserved ?? 0} />
          <Kpi label="Timetable" value={availability.data?.summary?.timetableOccupied ?? 0} />
          <Kpi label="Unavailable" value={availability.data?.summary?.unavailable ?? 0} />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <Field
          label="From"
          value={filters.from}
          readonly={false}
          onChange={(from) => setFilters((prev) => ({ ...prev, from }))}
        />
        <Field
          label="To"
          value={filters.to}
          readonly={false}
          onChange={(to) => setFilters((prev) => ({ ...prev, to }))}
        />
        <SelectField
          label="Room"
          value={filters.classroomId}
          readonly={false}
          onChange={(classroomId) => setFilters((prev) => ({ ...prev, classroomId }))}
          options={(rooms.data ?? []).map((room) => ({
            value: room.id,
            label: `${room.code} - ${room.name}`,
          }))}
        />
        <SelectField
          label="Reservation Status"
          value={filters.status}
          readonly={false}
          onChange={(status) => setFilters((prev) => ({ ...prev, status }))}
          options={[
            'ALL',
            'PENDING_APPROVAL',
            'APPROVED',
            'RESERVED',
            'CANCELLED',
            'REJECTED',
            'COMPLETED',
          ].map((status) => ({ value: status === 'ALL' ? '' : status, label: status }))}
        />
      </div>

      <ReservationForm
        rooms={rooms.data ?? []}
        defaultRoomId={filters.classroomId}
        saving={reserveMut.isPending}
        onSave={(payload) => reserveMut.mutate(payload)}
      />

      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-border/60 p-3">
          <h3 className="mb-3 text-sm font-semibold">Availability Grid</h3>
          {availability.isLoading ? <Loading label="Loading room calendar..." /> : null}
          <div className="space-y-2">
            {cards.map((card: any) => (
              <div key={card.room.id} className="rounded-2xl border border-border/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {card.room.code} · {card.room.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {card.room.roomType?.name ?? 'Room'} · Capacity {card.room.capacity}
                    </p>
                  </div>
                  <StatusBadge status={card.status} />
                </div>
                <div className="mt-3 grid gap-1 md:grid-cols-7">
                  {days.map((day) => {
                    const dayReservations = card.reservations.filter(
                      (reservation: InfrastructureReservation) =>
                        sameDate(reservation.startAt, day),
                    );
                    const state =
                      card.room.status !== 'ACTIVE'
                        ? card.room.status
                        : dayReservations.length
                          ? 'RESERVED'
                          : card.timetableEntries.length
                            ? 'TIMETABLE'
                            : 'FREE';
                    return (
                      <div
                        key={day}
                        className={cn(
                          'rounded-xl border px-2 py-2 text-xs',
                          state === 'FREE'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : state === 'RESERVED'
                              ? 'border-blue-200 bg-blue-50 text-blue-800'
                              : 'border-amber-200 bg-amber-50 text-amber-800',
                        )}
                      >
                        <p className="font-semibold">{shortDate(day)}</p>
                        <p>{state}</p>
                        {dayReservations
                          .slice(0, 2)
                          .map((reservation: InfrastructureReservation) => (
                            <p key={reservation.id} className="truncate text-[10px]">
                              {timeRange(reservation)} {reservation.title}
                            </p>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!cards.length && !availability.isLoading ? (
              <p className="text-sm text-muted-foreground">
                No rooms found for the selected filter.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 p-3">
          <h3 className="mb-3 text-sm font-semibold">Reservation Requests</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            {selectedRoom
              ? `Filtered for ${selectedRoom.code}`
              : 'All rooms in selected date range'}
          </p>
          {reservations.isLoading ? <Loading label="Loading reservations..." /> : null}
          <div className="space-y-2">
            {(reservations.data ?? []).map((reservation) => {
              const room = rooms.data?.find((item) => item.id === reservation.classroomId);
              return (
                <div key={reservation.id} className="rounded-2xl border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{reservation.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {room ? `${room.code} · ${room.name}` : reservation.classroomId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(reservation.startAt)} to {formatDateTime(reservation.endAt)}
                      </p>
                    </div>
                    <StatusBadge status={reservation.status} />
                  </div>
                  {reservation.remarks ? (
                    <p className="mt-2 text-xs text-muted-foreground">{reservation.remarks}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => statusMut.mutate({ id: reservation.id, status: 'APPROVED' })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => statusMut.mutate({ id: reservation.id, status: 'RESERVED' })}
                    >
                      Reserve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => statusMut.mutate({ id: reservation.id, status: 'COMPLETED' })}
                    >
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive"
                      onClick={() => statusMut.mutate({ id: reservation.id, status: 'CANCELLED' })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })}
            {!reservations.data?.length && !reservations.isLoading ? (
              <p className="text-sm text-muted-foreground">No reservations in this range.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReservationForm({
  rooms,
  defaultRoomId,
  saving,
  onSave,
}: {
  rooms: InfrastructureRoom[];
  defaultRoomId: string;
  saving: boolean;
  onSave: (payload: {
    classroomId: string;
    title: string;
    purpose?: string;
    startAt: string;
    endAt: string;
    remarks?: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    classroomId: defaultRoomId,
    title: '',
    purpose: 'GENERAL',
    date: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '10:00',
    remarks: '',
  });
  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
      <h3 className="mb-3 text-sm font-semibold">Create Reservation Request</h3>
      <div className="grid gap-2 md:grid-cols-6">
        <SelectField
          label="Room"
          value={form.classroomId || defaultRoomId}
          readonly={false}
          onChange={(classroomId) => update({ classroomId })}
          options={rooms.map((room) => ({ value: room.id, label: `${room.code} - ${room.name}` }))}
        />
        <Field
          label="Title"
          value={form.title}
          readonly={false}
          onChange={(title) => update({ title })}
        />
        <Field
          label="Purpose"
          value={form.purpose}
          readonly={false}
          onChange={(purpose) => update({ purpose })}
        />
        <Field
          label="Date"
          value={form.date}
          readonly={false}
          onChange={(date) => update({ date })}
        />
        <Field
          label="Start"
          value={form.startTime}
          readonly={false}
          onChange={(startTime) => update({ startTime })}
        />
        <Field
          label="End"
          value={form.endTime}
          readonly={false}
          onChange={(endTime) => update({ endTime })}
        />
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
        <Field
          label="Remarks"
          value={form.remarks}
          readonly={false}
          onChange={(remarks) => update({ remarks })}
        />
        <Button
          className="mt-5"
          disabled={saving || !(form.classroomId || defaultRoomId) || !form.title}
          onClick={() =>
            onSave({
              classroomId: form.classroomId || defaultRoomId,
              title: form.title,
              purpose: form.purpose,
              startAt: new Date(`${form.date}T${form.startTime}:00`).toISOString(),
              endAt: new Date(`${form.date}T${form.endTime}:00`).toISOString(),
              remarks: form.remarks,
            })
          }
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reserve
        </Button>
      </div>
    </div>
  );
}

function ImportExportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const validateMut = useMutation({
    mutationFn: (f: File) => validateInfrastructureImport(f),
    onSuccess: setResult,
    onError: showApiError,
  });
  const commitMut = useMutation({
    mutationFn: (f: File) => commitInfrastructureImport(f),
    onSuccess: setResult,
    onError: showApiError,
  });
  const download = async (kind: 'template' | 'export') => {
    const blob =
      kind === 'template'
        ? await downloadInfrastructureTemplate()
        : await downloadInfrastructureExport();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      kind === 'template' ? 'infrastructure-room-template.xlsx' : 'infrastructure-rooms.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-4">
      <h2 className="text-lg font-semibold">Infrastructure Import / Export</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => download('template')}>
          <Download className="mr-2 h-4 w-4" />
          Template
        </Button>
        <Button variant="outline" onClick={() => download('export')}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <input
          type="file"
          accept=".xlsx"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Button
          disabled={!file || validateMut.isPending}
          onClick={() => file && validateMut.mutate(file)}
        >
          <Upload className="mr-2 h-4 w-4" />
          Validate
        </Button>
        <Button
          disabled={!file || commitMut.isPending}
          onClick={() => file && commitMut.mutate(file)}
        >
          Commit
        </Button>
      </div>
      <pre className="mt-3 max-h-96 overflow-auto rounded-2xl bg-muted/40 p-3 text-xs">
        {JSON.stringify(result, null, 2)}
      </pre>
    </section>
  );
}

function ReportsPanel() {
  const [type, setType] = useState('capacity');
  const report = useQuery({
    queryKey: ['infrastructure', 'report', type],
    queryFn: () => fetchInfrastructureReport(type),
  });
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Infrastructure Reports</h2>
        <Select value={type} onChange={setType}>
          <option value="capacity">Capacity Report</option>
          <option value="maintenance">Maintenance Report</option>
          <option value="shared-hall-usage">Shared Hall Usage</option>
          <option value="room-list">Room List</option>
        </Select>
      </div>
      <pre className="mt-3 max-h-96 overflow-auto rounded-2xl bg-muted/40 p-3 text-xs">
        {JSON.stringify(report.data ?? [], null, 2)}
      </pre>
    </section>
  );
}

function SettingsPanel() {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: seedInfrastructureRoomTypes,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['infrastructure'] }),
    onError: showApiError,
  });
  return (
    <section className="rounded-3xl border border-border/60 bg-card p-4">
      <h2 className="text-lg font-semibold">Infrastructure Settings</h2>
      <p className="text-sm text-muted-foreground">
        Seed standard higher education room categories and maintain configurable room type master.
      </p>
      <Button className="mt-3" onClick={() => mut.mutate()} disabled={mut.isPending}>
        {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Seed Default Room Types
      </Button>
    </section>
  );
}

function ActionBar({
  archived,
  compact,
  onView,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  archived: boolean;
  compact?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const size = compact ? 'h-8 w-8 p-0' : 'h-8 px-2 text-xs';
  return (
    <div className={cn('mt-3 flex flex-wrap gap-1', compact && 'mt-0 justify-end')}>
      <Button title="View" className={size} variant="outline" size="sm" onClick={onView}>
        <Eye className="h-3.5 w-3.5" />
        {compact ? null : <span className="ml-1">View</span>}
      </Button>
      <Button title="Edit" className={size} variant="outline" size="sm" onClick={onEdit}>
        <Edit3 className="h-3.5 w-3.5" />
        {compact ? null : <span className="ml-1">Edit</span>}
      </Button>
      <Button title="Duplicate" className={size} variant="outline" size="sm" onClick={onDuplicate}>
        <Copy className="h-3.5 w-3.5" />
        {compact ? null : <span className="ml-1">Duplicate</span>}
      </Button>
      <Button
        title={archived ? 'Activate' : 'Archive'}
        className={size}
        variant="outline"
        size="sm"
        onClick={onArchive}
      >
        <Archive className="h-3.5 w-3.5" />
        {compact ? null : <span className="ml-1">{archived ? 'Activate' : 'Archive'}</span>}
      </Button>
      <Button
        title="Delete"
        className={cn(size, 'text-destructive')}
        variant="outline"
        size="sm"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {compact ? null : <span className="ml-1">Delete</span>}
      </Button>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl border border-border bg-background p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  readonly,
  saving,
  onClose,
  onSave,
}: {
  readonly: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      {!readonly ? (
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save Changes
        </Button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  readonly,
  onChange,
}: {
  label: string;
  value: string;
  readonly: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium">
      {label}
      <input
        disabled={readonly}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none disabled:bg-muted"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  readonly,
  onChange,
}: {
  label: string;
  value: number | string;
  readonly: boolean;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="text-xs font-medium">
      {label}
      <input
        disabled={readonly}
        type="number"
        value={value}
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
        className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none disabled:bg-muted"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  readonly,
  options,
  onChange,
}: {
  label: string;
  value: string;
  readonly: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium">
      {label}
      <Select value={value} onChange={onChange} disabled={readonly}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search code/name/building..."
        className="h-8 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none disabled:bg-muted"
    >
      {children}
    </select>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-background/70 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        {icon ? <span className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</span> : null}
      </div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
        status === 'ACTIVE'
          ? 'bg-emerald-100 text-emerald-700'
          : status === 'ARCHIVED'
            ? 'bg-slate-200 text-slate-700'
            : 'bg-amber-100 text-amber-700',
      )}
    >
      {status}
    </span>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function defaultRoom(mode?: 'labs' | 'shared-halls'): Partial<InfrastructureRoom> {
  return {
    code: '',
    name: '',
    capacity: 40,
    status: 'ACTIVE',
    availableForTimetable: true,
    availableForAttendance: true,
    isPracticalLab: mode === 'labs',
    isSharedHall: mode === 'shared-halls',
    availableForCombined: mode === 'shared-halls',
  };
}

function duplicateRoom(room: InfrastructureRoom): Partial<InfrastructureRoom> {
  return {
    ...room,
    id: undefined,
    code: `${room.code}-COPY`,
    name: `${room.name} Copy`,
    status: 'ACTIVE',
  };
}

function prepareRoomPayload(room: Partial<InfrastructureRoom>, mode?: 'labs' | 'shared-halls') {
  return {
    ...room,
    campusId: room.campusId || undefined,
    buildingId: room.buildingId || undefined,
    floorId: room.floorId || undefined,
    roomTypeId: room.roomTypeId || room.roomType?.id || undefined,
    code: String(room.code ?? '')
      .trim()
      .toUpperCase(),
    name: String(room.name ?? '').trim(),
    capacity: Number(room.capacity ?? 40),
    isPracticalLab: mode === 'labs' ? true : room.isPracticalLab,
    isSharedHall: mode === 'shared-halls' ? true : room.isSharedHall,
    availableForCombined: mode === 'shared-halls' ? true : room.availableForCombined,
  };
}

function csv(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function confirmDelete(row: { code?: string; name?: string }) {
  return window.confirm(
    `Delete record?\n\nYou are about to permanently delete:\n${row.code ?? ''} ${row.name ?? ''}\n\nThis action cannot be undone. If it is linked to timetable, attendance, bookings, or reservations the system will block deletion and ask you to archive instead.`,
  );
}

function confirmDeleteMany(rows: Array<{ code?: string; name?: string }>) {
  return window.confirm(
    `Delete ${rows.length} selected records?\n\nLinked records will be blocked by dependency validation. Use Archive for historical records.`,
  );
}

function exportSelectedRooms(rows: InfrastructureRoom[]) {
  const header = ['Code', 'Name', 'Type', 'Capacity', 'Status'];
  const body = rows.map((row) => [
    row.code,
    row.name,
    row.roomType?.name ?? '',
    row.capacity,
    row.status ?? 'ACTIVE',
  ]);
  const csvText = [header, ...body]
    .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'selected-infrastructure-rooms.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function startOfDayIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endOfDayIso(value: string) {
  return new Date(`${value}T23:59:59`).toISOString();
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const days: string[] = [];
  for (
    let cursor = new Date(start);
    cursor <= end && days.length < 14;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

function sameDate(value: string, date: string) {
  return new Date(value).toISOString().slice(0, 10) === date;
}

function shortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeRange(reservation: InfrastructureReservation) {
  const start = new Date(reservation.startAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const end = new Date(reservation.endAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${start}-${end}`;
}

function showApiError(error: unknown) {
  const anyError = error as any;
  const response = anyError?.response?.data;
  const message =
    typeof response?.message === 'string'
      ? response.message
      : (response?.message?.message ?? anyError?.message ?? 'Action failed');
  const usedIn = response?.message?.usedIn ?? response?.usedIn;
  const detail = Array.isArray(usedIn)
    ? `\n\nUsed in:\n${usedIn.map((row: any) => `- ${row.count} ${row.label}`).join('\n')}`
    : '';
  window.alert(`${message}${detail}`);
}
