import { api } from '@/services/api';
import { downloadBlob } from '@/utils/download-blob';

const base = '/v1/communication/birthdays';

export type BirthdayAudience = 'STUDENT' | 'STAFF';
export type BirthdayWindow = 'today' | 'tomorrow' | 'next7' | 'next30' | 'month';
export type BirthdayStatus = 'SENT' | 'FAILED' | 'QUEUED' | 'PENDING' | 'UPCOMING' | 'MISSED';

export type BirthdayOverview = {
  todayStudents: number;
  todayStaff: number;
  upcoming: number;
  sentToday: number;
  pending: number;
  failed: number;
  timezone: string;
  date: string;
};

export type BirthdayPerson = {
  id: string;
  audience: BirthdayAudience;
  userId: string | null;
  fullName: string;
  code: string | null;
  department: string | null;
  programme: string | null;
  semester: number | null;
  dateOfBirth: string;
  contact: string | null;
  email: string | null;
  photoUrl: string | null;
  staffType: string | null;
  status: BirthdayStatus;
  failureReason: string | null;
};

export type BirthdayTemplate = {
  id: string;
  code: string;
  name: string;
  subject: string | null;
  bodyText: string | null;
  category: string;
};

export type BirthdaySettings = {
  enabled: boolean;
  studentsEnabled: boolean;
  staffEnabled: boolean;
  sendTime: string;
  channels: string[];
  studentTemplateCode: string;
  staffTemplateCode: string;
  upcomingReminders: boolean;
  preventDuplicates: boolean;
  notifyPeers: boolean;
  lastRunDate: string | null;
};

export type BirthdayHistoryRow = {
  recipientName: string | null;
  category: string;
  birthdayDate: string | null;
  message: string | null;
  channel: string | null;
  sentAt: string | null;
  status: string | null;
  sentBy: string | null;
  failureReason: string | null;
};

export const BIRTHDAY_CHANNELS = [
  { value: 'PUSH', label: 'Push' },
  { value: 'IN_APP', label: 'In-app' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
] as const;

export function fetchBirthdayOverview() {
  return api.get<BirthdayOverview>(`${base}/overview`).then((res) => res.data);
}

export function fetchBirthdayPeople(params: {
  audience: BirthdayAudience;
  window?: BirthdayWindow;
  month?: string;
  day?: number;
  staffType?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return api
    .get<{ total: number; page: number; pageSize: number; rows: BirthdayPerson[] }>(base, {
      params,
    })
    .then((res) => res.data);
}

export function fetchBirthdayCalendar(month: string) {
  return api
    .get<{
      month: string;
      year: number;
      monthNumber: number;
      startWeekday: number;
      today: number | null;
      days: Array<{ day: number; students: number; staff: number }>;
    }>(`${base}/calendar`, { params: { month } })
    .then((res) => res.data);
}

export function fetchBirthdayHistory(params: {
  audience?: BirthdayAudience;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return api
    .get<{
      total: number;
      page: number;
      pageSize: number;
      rows: BirthdayHistoryRow[];
    }>(`${base}/history`, { params })
    .then((res) => res.data);
}

export async function exportBirthdayHistory(format: 'xlsx' | 'pdf', audience?: BirthdayAudience) {
  const { data } = await api.get<Blob>(`${base}/history/export`, {
    params: { format, audience },
    responseType: 'blob',
  });
  downloadBlob(data, format === 'pdf' ? 'birthday-wishes-report.pdf' : 'birthday-wishes.xlsx');
}

export function fetchBirthdayTemplates() {
  return api.get<BirthdayTemplate[]>(`${base}/templates`).then((res) => res.data);
}

export function saveBirthdayTemplate(payload: {
  name: string;
  audience: 'STUDENT' | 'STAFF' | 'BOTH';
  subject: string;
  body: string;
}) {
  return api.post(`${base}/templates`, payload).then((res) => res.data);
}

export function fetchBirthdaySettings() {
  return api.get<BirthdaySettings>(`${base}/settings`).then((res) => res.data);
}

export function saveBirthdaySettings(payload: Omit<BirthdaySettings, 'lastRunDate'>) {
  return api.put<BirthdaySettings>(`${base}/settings`, payload).then((res) => res.data);
}

export function previewBirthdayWish(payload: {
  audience: BirthdayAudience;
  id?: string;
  templateId?: string;
  subject?: string;
  body?: string;
}) {
  return api
    .post<{
      subject: string;
      body: string;
      html: string;
      recipient: string;
    }>(`${base}/preview`, payload)
    .then((res) => res.data);
}

export function sendBirthdayWishes(payload: {
  audience: BirthdayAudience;
  ids: string[];
  channels: string[];
  templateId?: string;
  subject?: string;
  body?: string;
  retry?: boolean;
}) {
  return api
    .post<{
      queued: number;
      skipped: number;
      failed: number;
      results: Array<{ id: string; name: string; status: string; reason?: string }>;
    }>(`${base}/send`, payload)
    .then((res) => res.data);
}
