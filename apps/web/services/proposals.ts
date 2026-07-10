import { api } from '@/services/api';
import type { ProposalCustomization, ProposalDefaults, ProposalPreset } from '@/types/proposals';

export async function fetchProposalDefaults() {
  const { data } = await api.get('/v1/proposals/defaults');
  return data as ProposalDefaults;
}

export async function previewProposal(payload: ProposalCustomization) {
  const { data } = await api.post('/v1/proposals/preview', payload);
  return data as { html: string };
}

export async function exportProposal(
  payload: ProposalCustomization,
  format: 'html' | 'pdf' | 'docx',
) {
  const res = await api.post('/v1/proposals/export', payload, {
    params: { format },
    responseType: 'blob',
  });
  return {
    blob: res.data as Blob,
    contentDisposition:
      (res.headers['content-disposition'] as string | undefined) ??
      (res.headers['Content-Disposition'] as string | undefined),
  };
}

export async function fetchProposalPresets() {
  const { data } = await api.get('/v1/proposals/presets');
  return data as ProposalPreset[];
}

export async function createProposalPreset(name: string, data: ProposalCustomization) {
  const res = await api.post('/v1/proposals/presets', { name, data });
  return res.data as ProposalPreset;
}

export async function updateProposalPreset(
  id: string,
  payload: Partial<{ name: string; data: ProposalCustomization }>,
) {
  const res = await api.post(`/v1/proposals/presets/${id}`, payload);
  return res.data as ProposalPreset;
}

export async function deleteProposalPreset(id: string) {
  await api.post(`/v1/proposals/presets/${id}/delete`, {});
}
