import { apiFetch } from '@/api/client';
import type { PrincipalMailListItem, PrincipalMailMessage } from '@/types/principal-desk';

export type PrincipalCommsStats = {
  connected: boolean;
  accountId?: string;
  googleEmail?: string;
  unread: number;
  starred: number;
  today: number;
};

export function fetchPrincipalCommsStats() {
  return apiFetch<PrincipalCommsStats>('/v1/principal-comms/stats');
}

export function fetchPrincipalMessages(params: { folder?: string; q?: string; take?: number }) {
  const search = new URLSearchParams();
  if (params.folder) search.set('folder', params.folder);
  if (params.q) search.set('q', params.q);
  if (params.take) search.set('take', String(params.take));
  const qs = search.toString();
  return apiFetch<{
    account: { id: string; googleEmail: string } | null;
    items: PrincipalMailListItem[];
    nextCursor: string | null;
  }>(`/v1/principal-comms/messages${qs ? `?${qs}` : ''}`);
}

export function fetchPrincipalMessage(id: string) {
  return apiFetch<PrincipalMailMessage>(`/v1/principal-comms/messages/${id}`);
}

export function principalMessageAction(
  id: string,
  action: 'star' | 'unstar' | 'archive' | 'trash' | 'markRead' | 'markUnread',
) {
  return apiFetch(`/v1/principal-comms/messages/${id}/actions`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export function sendPrincipalMail(payload: {
  accountId: string;
  toAddresses: string[];
  subject: string;
  bodyHtml: string;
  replyToMessageId?: string;
}) {
  return apiFetch('/v1/principal-comms/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function startPrincipalMailboxOAuth(
  accountLabel: 'PERSONAL' | 'PRINCIPAL_OFFICE' = 'PERSONAL',
) {
  return apiFetch<{ authUrl: string }>('/v1/principal-comms/accounts/oauth/start', {
    method: 'POST',
    body: JSON.stringify({ accountLabel }),
  });
}
