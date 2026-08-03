import { api } from '@/services/api';

export type PrincipalMailboxAccount = {
  id: string;
  googleEmail: string;
  accountLabel: string;
  status: string;
  lastSyncedAt?: string | null;
  createdAt?: string;
};

export type PrincipalMailListItem = {
  id: string;
  subject: string;
  snippet: string;
  fromAddress: string;
  fromName?: string | null;
  receivedAt: string;
  starred: boolean;
  isRead: boolean;
  hasAttachment: boolean;
  importance: string;
  category: string;
  folder: string;
};

export type PrincipalMailMessage = PrincipalMailListItem & {
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  bodyHtml?: string | null;
  bodyText?: string | null;
  gmailMessageId?: string;
  gmailThreadId?: string;
  attachments?: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }[];
  account?: { id: string; googleEmail: string };
};

export type PrincipalCommsStats = {
  connected: boolean;
  accountId?: string;
  googleEmail?: string;
  unread: number;
  starred: number;
  today: number;
  university: number;
  government: number;
};

export async function fetchPrincipalCommsStats() {
  const { data } = await api.get('/v1/principal-comms/stats');
  return data as PrincipalCommsStats;
}

export async function fetchPrincipalMailboxAccounts() {
  const { data } = await api.get('/v1/principal-comms/accounts');
  return data as PrincipalMailboxAccount[];
}

export async function fetchPrincipalCommsOAuthStatus() {
  const { data } = await api.get('/v1/principal-comms/oauth/status');
  return data as { configured: boolean };
}

export async function startPrincipalMailboxOAuth(
  accountLabel: 'PERSONAL' | 'PRINCIPAL_OFFICE' = 'PERSONAL',
) {
  const { data } = await api.post('/v1/principal-comms/accounts/oauth/start', {
    accountLabel,
  });
  return data as { authUrl: string; state: string };
}

export async function disconnectPrincipalMailbox(accountId: string) {
  const { data } = await api.delete(`/v1/principal-comms/accounts/${accountId}`);
  return data;
}

export async function syncPrincipalMailbox(payload?: { accountId?: string; full?: boolean }) {
  const { data } = await api.post('/v1/principal-comms/sync', payload ?? {});
  return data as { imported: number; newMessages: number; error?: string };
}

export async function fetchPrincipalMessages(params: {
  folder?: string;
  accountId?: string;
  q?: string;
  cursor?: string;
  take?: number;
  unreadOnly?: boolean;
}) {
  const { data } = await api.get('/v1/principal-comms/messages', { params });
  return data as {
    account: PrincipalMailboxAccount | null;
    items: PrincipalMailListItem[];
    nextCursor: string | null;
  };
}

export async function fetchPrincipalMessage(id: string) {
  const { data } = await api.get(`/v1/principal-comms/messages/${id}`);
  return data as PrincipalMailMessage;
}

export async function principalMessageAction(
  id: string,
  action: 'star' | 'unstar' | 'archive' | 'trash' | 'markRead' | 'markUnread',
) {
  const { data } = await api.post(`/v1/principal-comms/messages/${id}/actions`, {
    action,
  });
  return data;
}

export async function sendPrincipalMail(payload: {
  accountId: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject: string;
  bodyHtml: string;
  replyToMessageId?: string;
  draftId?: string;
}) {
  const { data } = await api.post('/v1/principal-comms/send', payload);
  return data as { gmailMessageId: string; threadId: string };
}

export async function savePrincipalDraft(payload: {
  accountId: string;
  draftId?: string;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  replyToMessageId?: string;
}) {
  const { data } = await api.post('/v1/principal-comms/drafts', payload);
  return data;
}

export async function downloadPrincipalAttachment(id: string) {
  const { data } = await api.get(`/v1/principal-comms/attachments/${id}/download`);
  return data as {
    filename: string;
    mimeType: string;
    dataBase64Url: string;
    size: number;
  };
}

export async function fetchPrincipalCommsAudit() {
  const { data } = await api.get('/v1/principal-comms/audit');
  return data as Array<{
    id: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
}
