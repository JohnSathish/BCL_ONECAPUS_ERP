import { api } from '@/services/api';
import type {
  DashboardChart,
  DashboardChartWidgetId,
  DashboardFilters,
  DashboardOverview,
  ShiftIntelligence,
} from '@/types/dashboard-analytics';

function filterParams(filters: DashboardFilters) {
  const params: Record<string, string> = {};
  if (filters.academicYearId) params.academicYearId = filters.academicYearId;
  if (filters.semesterId) params.semesterId = filters.semesterId;
  if (filters.shiftId) params.shiftId = filters.shiftId;
  if (filters.departmentId) params.departmentId = filters.departmentId;
  if (filters.programVersionId) params.programVersionId = filters.programVersionId;
  if (filters.campusId) params.campusId = filters.campusId;
  if (filters.institutionId) params.institutionId = filters.institutionId;
  return params;
}

export async function fetchDashboardOverview(
  filters: DashboardFilters,
): Promise<DashboardOverview> {
  const { data } = await api.get<DashboardOverview>('/v1/dashboard/overview', {
    params: filterParams(filters),
  });
  return data;
}

export async function fetchDashboardChart(
  widgetId: DashboardChartWidgetId,
  filters: DashboardFilters,
): Promise<DashboardChart> {
  const { data } = await api.get<DashboardChart>(`/v1/dashboard/charts/${widgetId}`, {
    params: filterParams(filters),
  });
  return data;
}

export async function fetchShiftIntelligence(
  filters: DashboardFilters,
): Promise<ShiftIntelligence> {
  const { data } = await api.get<ShiftIntelligence>('/v1/dashboard/shift-intelligence', {
    params: filterParams(filters),
  });
  return data;
}
