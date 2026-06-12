import { api } from '@/services/api';

export type InfrastructureRoom = {
  id: string;
  code: string;
  name: string;
  shortName?: string | null;
  description?: string | null;
  campusId?: string | null;
  buildingId?: string | null;
  floorId?: string | null;
  roomTypeId?: string | null;
  capacity: number;
  practicalCapacity?: number | null;
  examCapacity?: number | null;
  standingCapacity?: number | null;
  status?: string;
  facilities?: string[];
  shiftAvailability?: string[];
  isPracticalLab?: boolean;
  isSharedHall?: boolean;
  availableForTimetable?: boolean;
  availableForAttendance?: boolean;
  availableForExams?: boolean;
  availableForCombined?: boolean;
  supportsMdc?: boolean;
  supportsVac?: boolean;
  supportsAec?: boolean;
  supportsSec?: boolean;
  campus?: { id: string; name: string; code?: string | null } | null;
  roomType?: { id: string; code: string; name: string } | null;
};

export type InfrastructureBuilding = {
  id: string;
  code: string;
  name: string;
  campusId?: string | null;
  description?: string | null;
  status: string;
};

export type InfrastructureFloor = {
  id: string;
  buildingId: string;
  name: string;
  floorNumber?: number | null;
  description?: string | null;
  status: string;
};

export type InfrastructureReservation = {
  id: string;
  classroomId: string;
  title: string;
  purpose: string;
  status: string;
  startAt: string;
  endAt: string;
  remarks?: string | null;
  requestedById?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
};

export type RoomPayload = Partial<InfrastructureRoom> & {
  code: string;
  name: string;
  campusId?: string;
  buildingId?: string;
  floorId?: string;
  roomTypeId?: string;
  departmentRestrictionMode?: string;
  restrictedDepartmentIds?: string[];
  preferredDepartmentIds?: string[];
  supportedCategories?: string[];
};

export async function fetchInfrastructureDashboard() {
  const { data } = await api.get('/v1/infrastructure/dashboard');
  return data;
}

export async function fetchInfrastructureRooms(params?: Record<string, string | undefined>) {
  const { data } = await api.get<InfrastructureRoom[]>('/v1/infrastructure/rooms', { params });
  return data;
}

export async function createInfrastructureRoom(payload: RoomPayload) {
  const { data } = await api.post('/v1/infrastructure/rooms', payload);
  return data;
}

export async function updateInfrastructureRoom(id: string, payload: Partial<RoomPayload>) {
  const { data } = await api.patch(`/v1/infrastructure/rooms/${id}`, payload);
  return data;
}

export async function deleteInfrastructureRoom(id: string) {
  const { data } = await api.delete(`/v1/infrastructure/rooms/${id}`);
  return data;
}

export async function archiveInfrastructureRoom(id: string) {
  const { data } = await api.post(`/v1/infrastructure/rooms/${id}/archive`);
  return data;
}

export async function activateInfrastructureRoom(id: string) {
  const { data } = await api.post(`/v1/infrastructure/rooms/${id}/activate`);
  return data;
}

export async function bulkInfrastructureRooms(payload: {
  ids: string[];
  action: 'ARCHIVE' | 'ACTIVATE' | 'DELETE';
}) {
  const { data } = await api.post('/v1/infrastructure/rooms/bulk', payload);
  return data;
}

export async function fetchInfrastructureBuildings(params?: Record<string, string | undefined>) {
  const { data } = await api.get<InfrastructureBuilding[]>('/v1/infrastructure/buildings', {
    params,
  });
  return data;
}

export async function createInfrastructureBuilding(payload: {
  code: string;
  name: string;
  campusId?: string;
  description?: string;
  status?: string;
}) {
  const { data } = await api.post('/v1/infrastructure/buildings', payload);
  return data;
}

export async function updateInfrastructureBuilding(
  id: string,
  payload: Partial<InfrastructureBuilding>,
) {
  const { data } = await api.patch(`/v1/infrastructure/buildings/${id}`, payload);
  return data;
}

export async function deleteInfrastructureBuilding(id: string) {
  const { data } = await api.delete(`/v1/infrastructure/buildings/${id}`);
  return data;
}

export async function archiveInfrastructureBuilding(id: string) {
  const { data } = await api.post(`/v1/infrastructure/buildings/${id}/archive`);
  return data;
}

export async function activateInfrastructureBuilding(id: string) {
  const { data } = await api.post(`/v1/infrastructure/buildings/${id}/activate`);
  return data;
}

export async function fetchInfrastructureFloors(params?: Record<string, string | undefined>) {
  const { data } = await api.get<InfrastructureFloor[]>('/v1/infrastructure/floors', { params });
  return data;
}

export async function createInfrastructureFloor(payload: {
  buildingId: string;
  name: string;
  floorNumber?: number;
  description?: string;
  status?: string;
}) {
  const { data } = await api.post('/v1/infrastructure/floors', payload);
  return data;
}

export async function updateInfrastructureFloor(id: string, payload: Partial<InfrastructureFloor>) {
  const { data } = await api.patch(`/v1/infrastructure/floors/${id}`, payload);
  return data;
}

export async function deleteInfrastructureFloor(id: string) {
  const { data } = await api.delete(`/v1/infrastructure/floors/${id}`);
  return data;
}

export async function archiveInfrastructureFloor(id: string) {
  const { data } = await api.post(`/v1/infrastructure/floors/${id}/archive`);
  return data;
}

export async function activateInfrastructureFloor(id: string) {
  const { data } = await api.post(`/v1/infrastructure/floors/${id}/activate`);
  return data;
}

export async function fetchInfrastructureRoomTypes() {
  const { data } = await api.get('/v1/infrastructure/room-types');
  return data;
}

export async function seedInfrastructureRoomTypes() {
  const { data } = await api.post('/v1/infrastructure/room-types/seed-defaults');
  return data;
}

export async function fetchInfrastructureLabs() {
  const { data } = await api.get<InfrastructureRoom[]>('/v1/infrastructure/labs');
  return data;
}

export async function fetchInfrastructureSharedHalls() {
  const { data } = await api.get<InfrastructureRoom[]>('/v1/infrastructure/shared-halls');
  return data;
}

export async function fetchInfrastructureAvailability(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/infrastructure/availability', { params });
  return data;
}

export async function fetchInfrastructureReservations(params?: Record<string, string | undefined>) {
  const { data } = await api.get<InfrastructureReservation[]>('/v1/infrastructure/reservations', {
    params,
  });
  return data;
}

export async function createInfrastructureReservation(payload: {
  classroomId: string;
  title: string;
  purpose?: string;
  startAt: string;
  endAt: string;
  remarks?: string;
}) {
  const { data } = await api.post('/v1/infrastructure/reservations', payload);
  return data;
}

export async function updateInfrastructureReservationStatus(
  id: string,
  payload: { status: string; remarks?: string },
) {
  const { data } = await api.patch(`/v1/infrastructure/reservations/${id}/status`, payload);
  return data;
}

export async function fetchInfrastructureReport(type: string) {
  const { data } = await api.get(`/v1/infrastructure/reports/${type}`);
  return data;
}

export async function downloadInfrastructureTemplate() {
  const { data } = await api.get('/v1/infrastructure/import/template', { responseType: 'blob' });
  return data as Blob;
}

export async function downloadInfrastructureExport() {
  const { data } = await api.get('/v1/infrastructure/export', { responseType: 'blob' });
  return data as Blob;
}

export async function validateInfrastructureImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/infrastructure/import/validate', form);
  return data;
}

export async function commitInfrastructureImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/infrastructure/import/commit', form);
  return data;
}
