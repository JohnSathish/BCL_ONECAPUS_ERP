import type {
  BrandingAuditEntry,
  InstitutionBranding,
  AppThemeSettings,
  ThemePresetSummary,
} from '@/types/branding';
import { api } from './api';

export async function fetchInstitutionBranding(): Promise<InstitutionBranding> {
  const { data } = await api.get<InstitutionBranding>('/v1/branding');
  return data;
}

export async function updateInstitutionBranding(
  payload: Partial<InstitutionBranding> & { displayName: string; badges?: string[] },
): Promise<InstitutionBranding> {
  const { data } = await api.patch<InstitutionBranding>('/v1/branding', payload);
  return data;
}

export async function uploadInstitutionLogo(file: File): Promise<InstitutionBranding> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<InstitutionBranding>('/v1/branding/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function uploadInstitutionFavicon(file: File): Promise<InstitutionBranding> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<InstitutionBranding>('/v1/branding/favicon', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchBrandingAudit(limit = 20): Promise<BrandingAuditEntry[]> {
  const { data } = await api.get<BrandingAuditEntry[]>('/v1/branding/audit', {
    params: { limit },
  });
  return data;
}

export async function fetchThemeSettings(): Promise<AppThemeSettings> {
  const { data } = await api.get<AppThemeSettings>('/v1/branding/theme');
  return data;
}

export async function updateThemeSettings(
  payload: Partial<AppThemeSettings>,
): Promise<AppThemeSettings> {
  const { data } = await api.patch<AppThemeSettings>('/v1/branding/theme', payload);
  return data;
}

export async function applyThemePreset(presetId: string): Promise<AppThemeSettings> {
  const { data } = await api.post<AppThemeSettings>(`/v1/branding/theme/preset/${presetId}`);
  return data;
}

export async function exportThemeSettings(): Promise<object> {
  const { data } = await api.get<object>('/v1/branding/theme/export');
  return data;
}

export async function importThemeSettings(
  payload: Record<string, unknown>,
): Promise<AppThemeSettings> {
  const { data } = await api.post<AppThemeSettings>('/v1/branding/theme/import', payload);
  return data;
}

export async function fetchThemePresets(): Promise<ThemePresetSummary[]> {
  const { data } = await api.get<ThemePresetSummary[]>('/v1/branding/theme/presets');
  return data;
}
