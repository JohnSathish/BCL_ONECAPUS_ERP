import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '@/api/client';
import type { PrincipalMailListItem, PrincipalMailMessage } from '@/types/principal-desk';

const ACTIVE_ACCOUNT_KEY = 'principal-comms-active-account-id';

export type PrincipalMailboxAccount = {
  id: string;
  googleEmail: string;
  accountLabel: string;
  status: string;
  lastSyncedAt?: string | null;
  unread?: number;
};

export type PrincipalCommsStats = {
  connected: boolean;
  accountId?: string;
  googleEmail?: string;
  unread: number;
  starred: number;
  today: number;
};

export async function getStoredMailboxAccountId() {
  try {
    return await SecureStore.getItemAsync(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export async function setStoredMailboxAccountId(id: string | null) {
  try {
    if (id) await SecureStore.setItemAsync(ACTIVE_ACCOUNT_KEY, id);
    else await SecureStore.deleteItemAsync(ACTIVE_ACCOUNT_KEY);
  } catch {
    /* ignore */
  }
}

export function fetchPrincipalCommsStats(accountId?: string) {
  const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  return apiFetch<PrincipalCommsStats>(`/v1/principal-comms/stats${qs}`);
}

export function fetchPrincipalMailboxAccounts() {
  return apiFetch<PrincipalMailboxAccount[]>('/v1/principal-comms/accounts');
}

export function fetchPrincipalMessages(params: {
  folder?: string;
  accountId?: string;
  q?: string;
  take?: number;
}) {
  const search = new URLSearchParams();
  if (params.folder) search.set('folder', params.folder);
  if (params.accountId) search.set('accountId', params.accountId);
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

export function syncPrincipalMailbox(payload?: { accountId?: string; full?: boolean }) {
  return apiFetch<{ imported: number; newMessages: number; error?: string }>(
    '/v1/principal-comms/sync',
    {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export function downloadPrincipalAttachment(id: string) {
  return apiFetch<{
    filename: string;
    mimeType: string;
    dataBase64Url: string;
    size: number;
  }>(`/v1/principal-comms/attachments/${id}/download`);
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
