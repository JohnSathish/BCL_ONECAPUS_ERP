import { api } from '@/services/api';

export type AiLink = { label: string; href: string };
export type AiFieldOption = { key: string; label: string; selected?: boolean };
export type AiDownload = {
  label: string;
  filename: string;
  contentType: string;
  base64: string;
};
export type AiTablePayload = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  totalRows?: number;
};

export type AiChartPayload = {
  title: string;
  chartType: 'bar' | 'pie' | 'line';
  series: Array<{ label: string; value: number }>;
};

export type AiConfirmationPayload = {
  confirmationId: string;
  summary: string;
  actionLabel: string;
  danger?: boolean;
  reportGenerate?: boolean;
};

export type AiChatResponse = {
  answer: string;
  links?: AiLink[];
  source: 'live' | 'estimated' | 'rules' | 'llm' | 'knowledge' | 'hybrid';
  suggestedFollowUps?: string[];
  fieldOptions?: AiFieldOption[];
  downloads?: AiDownload[];
  table?: AiTablePayload;
  chart?: AiChartPayload;
  confirmation?: AiConfirmationPayload;
  sessionId: string;
  knowledgeSource?: {
    documentTitle: string;
    section?: string | null;
    pageRef?: string | null;
  };
};

const SESSION_KEY = 'onecampus-ai-session-id';

export function getAiSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function resetAiSessionId(): string {
  const id = crypto.randomUUID();
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function chatWithAiAssistant(
  question: string,
  sessionId?: string,
): Promise<AiChatResponse> {
  const { data } = await api.post<AiChatResponse>('/v1/ai-assistant/chat', {
    question,
    sessionId: sessionId ?? getAiSessionId(),
  });
  if (data.sessionId && typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, data.sessionId);
  }
  return data;
}

export async function selectAiReportFields(
  sessionId: string,
  columns: string[],
  format?: 'xlsx' | 'csv',
): Promise<AiChatResponse> {
  const { data } = await api.post<AiChatResponse>('/v1/ai-assistant/select-fields', {
    sessionId,
    columns,
    format,
  });
  return data;
}

export function downloadAiFile(file: AiDownload) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: file.contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function confirmAiAction(
  sessionId: string,
  confirmationId: string,
): Promise<AiChatResponse> {
  const { data } = await api.post<AiChatResponse>('/v1/ai-assistant/confirm', {
    sessionId,
    confirmationId,
  });
  return data;
}
