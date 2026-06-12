import { api } from '@/services/api';
import type {
  BoardSubjectRow,
  SupportDataCategoryMeta,
  SupportDataGroup,
  SupportDataRow,
} from '@/types/support-data';

export async function fetchSupportDataCategories(): Promise<SupportDataGroup[]> {
  const { data } = await api.get('/v1/support-data/categories');
  return data;
}

export async function fetchSupportDataCategoryMeta(
  category: string,
): Promise<SupportDataCategoryMeta> {
  const { data } = await api.get(`/v1/support-data/${category}/meta`);
  return data;
}

export async function fetchSupportDataRows(
  category: string,
  params?: {
    q?: string;
    activeOnly?: boolean;
    campusId?: string;
    institutionId?: string;
  },
): Promise<SupportDataRow[]> {
  const { data } = await api.get(`/v1/support-data/${category}`, {
    params: {
      q: params?.q || undefined,
      activeOnly: params?.activeOnly === false ? 'false' : undefined,
      campusId: params?.campusId,
      institutionId: params?.institutionId,
    },
  });
  return data;
}

export async function fetchBoardSubjects(params?: {
  q?: string;
  activeOnly?: boolean;
}): Promise<BoardSubjectRow[]> {
  return fetchSupportDataRows('board-subjects', {
    q: params?.q,
    activeOnly: params?.activeOnly ?? true,
  }) as Promise<BoardSubjectRow[]>;
}

export async function fetchBoardNames(params?: {
  q?: string;
  activeOnly?: boolean;
}): Promise<SupportDataRow[]> {
  return fetchSupportDataRows('board-names', {
    q: params?.q,
    activeOnly: params?.activeOnly ?? true,
  });
}

export async function createSupportDataRow(
  category: string,
  data: Record<string, unknown>,
): Promise<SupportDataRow> {
  const { data: row } = await api.post(`/v1/support-data/${category}`, { data });
  return row;
}

export async function updateSupportDataRow(
  category: string,
  id: string,
  data: Record<string, unknown>,
): Promise<SupportDataRow> {
  const { data: row } = await api.put(`/v1/support-data/${category}/${id}`, { data });
  return row;
}

export async function setSupportDataStatus(
  category: string,
  id: string,
  isActive: boolean,
): Promise<SupportDataRow> {
  const { data } = await api.patch(`/v1/support-data/${category}/${id}/status`, { isActive });
  return data;
}

export async function archiveSupportDataRow(category: string, id: string) {
  const { data } = await api.post(`/v1/support-data/${category}/${id}/archive`);
  return data;
}

export async function restoreSupportDataRow(category: string, id: string): Promise<SupportDataRow> {
  const { data } = await api.post(`/v1/support-data/${category}/${id}/restore`);
  return data;
}

export async function reorderSupportData(category: string, ids: string[]) {
  const { data } = await api.patch(`/v1/support-data/${category}/reorder`, { ids });
  return data;
}

export async function exportSupportData(category: string, q?: string): Promise<Blob> {
  const { data } = await api.get(`/v1/support-data/${category}/export`, {
    params: q ? { q } : undefined,
    responseType: 'blob',
  });
  return data as Blob;
}

export async function validateSupportDataImport(category: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/support-data/${category}/import/validate`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as {
    valid: boolean;
    rows: Record<string, unknown>[];
    errors: { row: number; message: string }[];
    total: number;
  };
}

export async function commitSupportDataImport(category: string, rows: Record<string, unknown>[]) {
  const { data } = await api.post(`/v1/support-data/${category}/import/commit`, { rows });
  return data as { created: number; failed: { code: string; error: string }[] };
}
