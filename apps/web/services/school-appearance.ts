import { api } from './api';
import type { AppearanceConfig } from '@/lib/school-sis/appearance';

export type SchoolAppearanceDto = {
  id: string;
  status: string;
  version: number;
  publishedAt?: string | null;
  updatedAt?: string;
  theme: string;
  mode: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  fontFamily: string;
  logoUrl?: string | null;
  darkLogoUrl?: string | null;
  mobileLogoUrl?: string | null;
  faviconUrl?: string | null;
  sidebarStyle: string;
  sidebarWidth: number;
  sidebarPosition: string;
  borderRadius: number;
  cardStyle: string;
  buttonStyle: string;
  loginLayout: string;
  loginBackground: string;
  loginOverlay: number;
  customCss: string;
  config: AppearanceConfig;
  canManage?: boolean;
  canCss?: boolean;
  accessibility?: { score: number; text: number; button: number };
  presets?: Array<{ id: string; name: string; primary: string; secondary: string; accent: string }>;
};

export const fetchSchoolAppearance = () =>
  api.get<SchoolAppearanceDto>('/v1/school-sis/appearance').then((r) => r.data);

export const fetchPublishedAppearance = () =>
  api
    .get<SchoolAppearanceDto>('/v1/school-sis/appearance/published')
    .then((r) => r.data)
    .catch(() => null);

export const saveSchoolAppearanceDraft = (payload: Record<string, unknown>) =>
  api.post<SchoolAppearanceDto>('/v1/school-sis/appearance/draft', payload).then((r) => r.data);

export const publishSchoolAppearance = () =>
  api.post<SchoolAppearanceDto>('/v1/school-sis/appearance/publish', {}).then((r) => r.data);

export const resetSchoolAppearance = () =>
  api.post<SchoolAppearanceDto>('/v1/school-sis/appearance/reset', {}).then((r) => r.data);

export const fetchAppearanceVersions = () =>
  api
    .get<
      Array<{ id: string; version: number; label: string; createdAt: string; publishedBy?: string }>
    >('/v1/school-sis/appearance/versions')
    .then((r) => r.data);

export const restoreAppearanceVersion = (id: string) =>
  api
    .post<SchoolAppearanceDto>(`/v1/school-sis/appearance/versions/${id}/restore`, {})
    .then((r) => r.data);

export const fetchAppearanceThemes = () =>
  api
    .get<
      Array<{ id: string; name: string; description: string; createdAt: string }>
    >('/v1/school-sis/appearance/themes')
    .then((r) => r.data);

export const saveAppearanceTheme = (name: string, description?: string) =>
  api.post('/v1/school-sis/appearance/themes', { name, description }).then((r) => r.data);

export const applyAppearanceTheme = (id: string) =>
  api
    .post<SchoolAppearanceDto>(`/v1/school-sis/appearance/themes/${id}/apply`, {})
    .then((r) => r.data);

export const deleteAppearanceTheme = (id: string) =>
  api.delete(`/v1/school-sis/appearance/themes/${id}`).then((r) => r.data);

export const exportAppearanceTheme = () =>
  api.get('/v1/school-sis/appearance/export').then((r) => r.data);

export const importAppearanceTheme = (snapshot: Record<string, unknown>) =>
  api
    .post<SchoolAppearanceDto>('/v1/school-sis/appearance/import', { snapshot })
    .then((r) => r.data);

export async function uploadAppearanceLogo(slot: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post<SchoolAppearanceDto>(
    `/v1/school-sis/appearance/logo?slot=${slot}`,
    body,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return data;
}
