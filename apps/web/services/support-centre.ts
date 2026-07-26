import { api } from '@/services/api';

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

export type SupportChatMessage = {
  id: string;
  senderUserId: string;
  senderRole: string;
  bodyOriginal: string;
  bodyTranslated?: string | null;
  langDetected?: string | null;
  langTarget?: string | null;
  deliveryStatus: string;
  createdAt: string;
  translationStatus?: string;
  translationNote?: string;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    storageUrl: string;
  }>;
};

export type SupportChatThread = {
  id: string;
  category: string;
  subject?: string | null;
  status: string;
  studentLang?: string;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadStudent?: number;
  unreadAgent?: number;
  closedAt?: string | null;
  department?: { id: string; name: string; code: string } | null;
  agent?: { id: string; displayName?: string | null; userId: string } | null;
  ticket?: { id: string; ticketNo: string; priority?: string } | null;
  messages?: SupportChatMessage[];
  student?: {
    id?: string | null;
    fullName?: string;
    photoPath?: string | null;
    departmentName?: string | null;
    rollNumber?: string | null;
    enrollmentNumber?: string | null;
  };
  waitMinutes?: number;
  priority?: string;
  language?: string;
};

export type SupportStudentContext = {
  studentId: string | null;
  userId: string;
  fullName: string;
  photoPath: string | null;
  enrollmentNumber: string | null;
  rollNumber: string | null;
  programme: string | null;
  semester: number | null;
  departmentName: string | null;
  mobile: string | null;
  email: string | null;
  attendancePercent: number | null;
  feeStatus: string | null;
  feeDueAmount: number | null;
  scholarshipStatus: string | null;
  academicAdvisor: string | null;
  links: {
    profile?: string;
    fees?: string;
    attendance?: string;
    documents?: string;
  };
};

export type SupportAiAssist = {
  summary: string;
  suggestedReply: string;
  sentiment: string;
  suggestedCategory: string;
  suggestedPriority: string;
  confidence: number;
  faqHints: Array<{ id: string; question: string }>;
  note?: string;
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

export async function fetchSupportDashboard() {
  const { data } = await api.get('/v1/helpdesk/dashboard');
  return data as {
    openTickets: number;
    pendingTickets: number;
    resolvedToday: number;
    activeChats: number;
    unassignedChats: number;
    waitingChats: number;
    onlineAgents: number;
    unreadMessages: number;
    messagesToday: number;
    chatsThisWeek: number;
    avgSatisfaction: number | null;
    recentChats: Array<{
      id: string;
      category: string;
      status: string;
      lastMessagePreview?: string | null;
      unreadAgent?: number;
      department?: { name: string } | null;
    }>;
    byCategory: Array<{ category: string; count: number }>;
  };
}

export async function fetchSupportTickets(params?: {
  status?: string;
  q?: string;
  category?: string;
}) {
  const { data } = await api.get('/v1/helpdesk/tickets', { params });
  return data as SupportTicket[];
}

export async function fetchSupportTicket(id: string) {
  const { data } = await api.get(`/v1/helpdesk/tickets/${id}`);
  return data as SupportTicket;
}

export async function createSupportTicket(body: {
  category?: string;
  subject: string;
  description?: string;
  priority?: string;
}) {
  const { data } = await api.post('/v1/helpdesk/tickets', body);
  return data as SupportTicket;
}

export async function transitionSupportTicket(id: string, status: string) {
  const { data } = await api.patch(`/v1/helpdesk/tickets/${id}/status`, { status });
  return data as SupportTicket;
}

export async function commentSupportTicket(id: string, body: string, isInternal?: boolean) {
  const { data } = await api.post(`/v1/helpdesk/tickets/${id}/comments`, {
    body,
    isInternal,
  });
  return data;
}

export async function fetchSupportChats(params?: {
  status?: string;
  departmentId?: string;
  q?: string;
  bucket?: string;
}) {
  const { data } = await api.get('/v1/helpdesk/chats', { params });
  return data as SupportChatThread[];
}

export async function fetchSupportStudentContext(threadId: string) {
  const { data } = await api.get(`/v1/helpdesk/chats/${threadId}/student-context`);
  return data as SupportStudentContext;
}

export async function fetchSupportAiAssist(threadId: string) {
  const { data } = await api.post(`/v1/helpdesk/chats/${threadId}/ai-assist`);
  return data as SupportAiAssist;
}

export async function convertSupportChatToTicket(
  threadId: string,
  body?: {
    category?: string;
    subject?: string;
    description?: string;
    priority?: string;
    assigneeUserId?: string;
  },
) {
  const { data } = await api.post(`/v1/helpdesk/chats/${threadId}/convert-ticket`, body ?? {});
  return data as SupportTicket;
}

export async function fetchSupportChat(id: string) {
  const { data } = await api.get(`/v1/helpdesk/chats/${id}`);
  return data as SupportChatThread;
}

export async function sendSupportChatMessage(id: string, body: string) {
  const { data } = await api.post(`/v1/helpdesk/chats/${id}/messages`, { body });
  return data as SupportChatMessage;
}

export async function assignSupportChat(id: string, agentId: string) {
  const { data } = await api.post(`/v1/helpdesk/chats/${id}/assign`, { agentId });
  return data;
}

export async function closeSupportChat(id: string) {
  const { data } = await api.post(`/v1/helpdesk/chats/${id}/close`);
  return data;
}

export async function fetchSupportFaqAdmin() {
  const { data } = await api.get('/v1/helpdesk/faq');
  return data as Array<{
    id: string;
    name: string;
    code: string;
    articles: Array<{
      id: string;
      question: string;
      answer: string;
      isPublished: boolean;
    }>;
  }>;
}

export async function createSupportFaqArticle(body: {
  categoryId: string;
  question: string;
  answer: string;
  isPublished?: boolean;
  keywords?: string[];
}) {
  const { data } = await api.post('/v1/helpdesk/faq/articles', body);
  return data;
}

export async function updateSupportFaqArticle(
  id: string,
  body: Partial<{ question: string; answer: string; isPublished: boolean }>,
) {
  const { data } = await api.patch(`/v1/helpdesk/faq/articles/${id}`, body);
  return data;
}

export async function fetchSupportDepartments() {
  const { data } = await api.get('/v1/helpdesk/departments');
  return data as Array<{ id: string; code: string; name: string }>;
}

export async function fetchSupportAgents() {
  const { data } = await api.get('/v1/helpdesk/agents');
  return data as Array<{
    id: string;
    userId: string;
    displayName?: string | null;
    isOnline: boolean;
    preferredLang?: string;
    department?: { name: string } | null;
  }>;
}

export async function upsertSupportAgent(body: {
  userId: string;
  departmentId?: string | null;
  displayName?: string;
  preferredLang?: string;
}) {
  const { data } = await api.post('/v1/helpdesk/agents', body);
  return data;
}

export async function setSupportAgentPresence(
  isOnline: boolean,
  displayName?: string,
  preferredLang?: string,
) {
  const { data } = await api.post('/v1/helpdesk/agents/presence', {
    isOnline,
    displayName,
    preferredLang,
  });
  return data as {
    id: string;
    userId: string;
    isOnline: boolean;
    displayName?: string | null;
    preferredLang?: string;
  };
}

export async function retranslateSupportMessage(
  threadId: string,
  messageId: string,
  targetLang?: string,
) {
  const { data } = await api.post(
    `/v1/helpdesk/chats/${threadId}/messages/${messageId}/retranslate`,
    { targetLang },
  );
  return data as SupportChatMessage;
}

export async function retranslateSupportThread(threadId: string, targetLang?: string) {
  const { data } = await api.post(`/v1/helpdesk/chats/${threadId}/retranslate`, {
    targetLang,
  });
  return data as { count: number; messages: SupportChatMessage[] };
}

export async function markSupportChatRead(threadId: string) {
  const { data } = await api.post(`/v1/helpdesk/chats/${threadId}/read`);
  return data;
}

export async function fetchSupportSettings() {
  const { data } = await api.get('/v1/helpdesk/settings');
  return data as Record<string, unknown>;
}

export async function updateSupportSettings(body: Record<string, unknown>) {
  const { data } = await api.put('/v1/helpdesk/settings', body);
  return data;
}

// Student APIs
export async function fetchStudentSupportMeta() {
  const { data } = await api.get('/v1/student/support/meta');
  return data as {
    categories: string[];
    settings: {
      contactEmail?: string;
      contactPhone?: string;
      supportHours?: string;
      welcomeMessage?: string;
      translationEnabled?: boolean;
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
}

export async function fetchStudentSupportFaq(q?: string) {
  const { data } = await api.get('/v1/student/support/faq', { params: { q } });
  return data as Array<{
    id: string;
    name: string;
    articles: Array<{ id: string; question: string; answer: string }>;
  }>;
}

export async function fetchStudentTickets() {
  const { data } = await api.get('/v1/student/support/tickets');
  return data as SupportTicket[];
}

export async function createStudentTicket(body: {
  category?: string;
  subject: string;
  description?: string;
  priority?: string;
}) {
  const { data } = await api.post('/v1/student/support/tickets', body);
  return data as SupportTicket;
}

export async function fetchStudentTicket(id: string) {
  const { data } = await api.get(`/v1/student/support/tickets/${id}`);
  return data as SupportTicket;
}

export async function rateStudentTicket(id: string, score: number, note?: string) {
  const { data } = await api.post(`/v1/student/support/tickets/${id}/rate`, {
    score,
    note,
  });
  return data;
}

export async function fetchStudentChats() {
  const { data } = await api.get('/v1/student/support/chats');
  return data as SupportChatThread[];
}

export async function openStudentChat(body: {
  category?: string;
  subject?: string;
  studentLang?: string;
  initialMessage?: string;
}) {
  const { data } = await api.post('/v1/student/support/chats', body);
  return data as SupportChatThread;
}

export async function fetchStudentChat(id: string) {
  const { data } = await api.get(`/v1/student/support/chats/${id}`);
  return data as SupportChatThread;
}

export async function sendStudentChatMessage(id: string, body: string) {
  const { data } = await api.post(`/v1/student/support/chats/${id}/messages`, {
    body,
  });
  return data as SupportChatMessage;
}

export async function markStudentChatRead(id: string) {
  const { data } = await api.post(`/v1/student/support/chats/${id}/read`);
  return data;
}

export async function closeStudentChat(id: string) {
  const { data } = await api.post(`/v1/student/support/chats/${id}/close`);
  return data as SupportChatThread;
}

export async function sendStudentChatTyping(id: string, isTyping = true) {
  const { data } = await api.post(`/v1/student/support/chats/${id}/typing`, {
    isTyping,
  });
  return data;
}

export async function uploadStudentChatFile(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/student/support/chats/${id}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as SupportChatMessage;
}

export async function uploadAdminChatFile(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/helpdesk/chats/${id}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as SupportChatMessage;
}
