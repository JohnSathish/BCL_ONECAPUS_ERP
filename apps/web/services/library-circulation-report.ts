import { api } from '@/services/api';
import type {
  CirculationAnalytics,
  CirculationFilters,
  CirculationOptions,
  CirculationRowsResponse,
  CirculationSummary,
} from '@/types/library-circulation-report';

const base = '/v1/library/reports/circulation';

function params(filters: CirculationFilters | Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  );
}

export const fetchCirculationOptions = () =>
  api.get<CirculationOptions>(`${base}/options`).then((r) => r.data);

export const fetchCirculationSummary = (filters: CirculationFilters) =>
  api.get<CirculationSummary>(`${base}/summary`, { params: params(filters) }).then((r) => r.data);

export const fetchCirculationRows = (filters: CirculationFilters) =>
  api.get<CirculationRowsResponse>(`${base}/rows`, { params: params(filters) }).then((r) => r.data);

export const fetchCirculationAnalytics = (filters: {
  year?: number;
  from?: string;
  to?: string;
  departmentId?: string;
  memberType?: string;
}) =>
  api
    .get<CirculationAnalytics>(`${base}/analytics`, { params: params(filters) })
    .then((r) => r.data);

/** Full filtered dataset (not just the visible page) as Excel, CSV or PDF. */
export const downloadCirculationReport = (
  format: 'xlsx' | 'csv' | 'pdf',
  filters: CirculationFilters,
) =>
  api
    .get(`${base}/export`, {
      params: params({ ...filters, page: undefined, limit: undefined, format }),
      responseType: 'blob',
    })
    .then((r) => r.data as Blob);
