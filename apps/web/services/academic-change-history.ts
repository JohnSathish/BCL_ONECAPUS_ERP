import { api } from '@/services/api';
import type {
  AcademicChangeHistoryList,
  AcademicChangeHistoryQuery,
} from '@/types/academic-change-history';

export async function fetchAcademicChangeHistory(
  studentId: string,
  query?: AcademicChangeHistoryQuery,
) {
  const { data } = await api.get(`/v1/students/${studentId}/academic-change-history`, {
    params: query,
  });
  return data as AcademicChangeHistoryList;
}

export async function exportAcademicChangeHistoryCsv(
  studentId: string,
  query?: AcademicChangeHistoryQuery,
) {
  const { data } = await api.get(`/v1/students/${studentId}/academic-change-history/export.csv`, {
    params: query,
    responseType: 'blob',
  });
  return data as Blob;
}

export function downloadAcademicChangeHistoryCsv(blob: Blob, studentId: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `academic-change-history-${studentId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
