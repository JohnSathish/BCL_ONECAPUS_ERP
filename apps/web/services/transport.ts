import { api } from '@/services/api';
import type {
  TransportAssignment,
  TransportCapacityAlert,
  TransportDashboard,
  TransportRoute,
  TransportStudentOption,
  TransportVehicle,
} from '@/types/transport';

const base = '/v1/transport';

export const fetchTransportDashboard = () =>
  api.get<TransportDashboard>(`${base}/dashboard`).then((r) => r.data);

export const fetchTransportAlerts = () =>
  api.get<TransportCapacityAlert[]>(`${base}/alerts`).then((r) => r.data);

export const searchTransportStudents = (params: { q?: string; limit?: number }) =>
  api.get<TransportStudentOption[]>(`${base}/students/search`, { params }).then((r) => r.data);

export const fetchRouteCapacity = (routeId: string) =>
  api.get<TransportCapacityAlert>(`${base}/routes/${routeId}/capacity`).then((r) => r.data);

export const fetchTransportRoutes = (params?: Record<string, string | number | undefined>) =>
  api.get<TransportRoute[]>(`${base}/routes`, { params }).then((r) => r.data);

export const createTransportRoute = (payload: Record<string, unknown>) =>
  api.post<TransportRoute>(`${base}/routes`, payload).then((r) => r.data);

export const addTransportStop = (routeId: string, payload: Record<string, unknown>) =>
  api.post(`${base}/routes/${routeId}/stops`, payload).then((r) => r.data);

export const fetchTransportVehicles = (params?: Record<string, string | number | undefined>) =>
  api.get<TransportVehicle[]>(`${base}/vehicles`, { params }).then((r) => r.data);

export const createTransportVehicle = (payload: Record<string, unknown>) =>
  api.post<TransportVehicle>(`${base}/vehicles`, payload).then((r) => r.data);

export const fetchTransportAssignments = (params?: Record<string, string | number | undefined>) =>
  api.get<TransportAssignment[]>(`${base}/assignments`, { params }).then((r) => r.data);

export const assignTransportStudent = (payload: {
  studentId: string;
  routeId: string;
  stopId?: string;
  notifyParents?: boolean;
}) => api.post<TransportAssignment>(`${base}/assignments`, payload).then((r) => r.data);

export const cancelTransportAssignment = (id: string) =>
  api.post(`${base}/assignments/${id}/cancel`).then((r) => r.data);
