import { apiFetch } from '@/api/client';

export const SUPPORT_CATEGORIES = [
  'ADMISSIONS',
  'FEES',
  'SCHOLARSHIPS',
  'EXAMINATION',
  'RESULTS',
  'CERTIFICATES',
  'HOSTEL',
  'LIBRARY',
  'TRANSPORT',
  'ERP_LOGIN',
  'TECHNICAL',
  'GENERAL',
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export type SupportChatMessage = {
  id: string;
  senderUserId: string;
  senderRole: string;
  bodyOriginal: string;
  bodyTranslated?: string | null;
  createdAt: string;
};

export type SupportChatThread = {
  id: string;
  category: string;
  subject?: string | null;
  status: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadStudent?: number;
  closedAt?: string | null;
  agent?: { id: string; displayName?: string | null; userId: string } | null;
  ticket?: { id: string; ticketNo: string; priority?: string } | null;
  messages?: SupportChatMessage[];
};

export type SupportTicket = {
  id: string;
  ticketNo: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  satisfactionScore?: number | null;
  department?: { name: string } | null;
  createdAt: string;
  updatedAt: string;
  comments?: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
  }>;
};

export type SupportMeta = {
  categories: string[];
  settings: {
    contactEmail?: string;
    contactPhone?: string;
    supportHours?: string;
    welcomeMessage?: string;
  };
  offices?: Array<{
    id: string;
    code: string;
    name: string;
    description?: string | null;
    onlineAgents: number;
    isOnline: boolean;
  }>;
};

export function formatSupportCategory(cat: string) {
  return cat
    .split('_')
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(' ');
}

export function formatSupportStatus(status: string) {
  return status
    .split('_')
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(' ');
}

export function supportStatusColor(status: string) {
  const s = status.toUpperCase();
  if (['OPEN', 'WAITING', 'NEW', 'PENDING', 'IN_PROGRESS', 'ASSIGNED'].includes(s)) {
    return '#d97706';
  }
  if (['RESOLVED', 'CLOSED', 'DONE'].includes(s)) return '#059669';
  return '#64748b';
}

export function fetchStudentSupportMeta() {
  return apiFetch<SupportMeta>('/v1/student/support/meta');
}

export function fetchStudentSupportFaq(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return apiFetch<
    Array<{
      id: string;
      name: string;
      articles: Array<{ id: string; question: string; answer: string }>;
    }>
  >(`/v1/student/support/faq${qs}`);
}

export function fetchStudentChats() {
  return apiFetch<SupportChatThread[]>('/v1/student/support/chats');
}

export function openStudentChat(body: {
  category?: string;
  subject?: string;
  studentLang?: string;
  initialMessage?: string;
}) {
  return apiFetch<SupportChatThread>('/v1/student/support/chats', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchStudentChat(id: string) {
  return apiFetch<SupportChatThread>(`/v1/student/support/chats/${id}`);
}

export function sendStudentChatMessage(id: string, body: string) {
  return apiFetch<SupportChatMessage>(`/v1/student/support/chats/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function markStudentChatRead(id: string) {
  return apiFetch(`/v1/student/support/chats/${id}/read`, { method: 'POST' });
}

export function closeStudentChat(id: string) {
  return apiFetch<SupportChatThread>(`/v1/student/support/chats/${id}/close`, {
    method: 'POST',
  });
}

export function fetchStudentTickets() {
  return apiFetch<SupportTicket[]>('/v1/student/support/tickets');
}

export function createStudentTicket(body: {
  category?: string;
  subject: string;
  description?: string;
  priority?: string;
}) {
  return apiFetch<SupportTicket>('/v1/student/support/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchStudentTicket(id: string) {
  return apiFetch<SupportTicket>(`/v1/student/support/tickets/${id}`);
}

export function commentStudentTicket(id: string, body: string) {
  return apiFetch(`/v1/student/support/tickets/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function rateStudentTicket(id: string, score: number, note?: string) {
  return apiFetch(`/v1/student/support/tickets/${id}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score, note }),
  });
}
