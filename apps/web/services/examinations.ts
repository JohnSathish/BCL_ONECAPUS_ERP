import { api } from '@/services/api';

export type ExamSession = {
  id: string;
  name: string;
  examType: string;
  semesterNo?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
  instructions?: string | null;
};

export type ExamPaper = {
  id: string;
  sessionId: string;
  courseId?: string | null;
  paperCode: string;
  paperName: string;
  examDate: string;
  startTime: string;
  endTime: string;
  semesterNo?: number | null;
  expectedCount: number;
  status: string;
};

export type ExamMarkPayload = {
  studentId: string;
  internalMarks?: number;
  externalMarks?: number;
  practicalMarks?: number;
  graceMarks?: number;
  maxMarks?: number;
  resultStatus?: string;
  entryStatus?: string;
  remarks?: string;
};

export async function fetchExamDashboard() {
  const { data } = await api.get('/v1/examinations/dashboard');
  return data;
}

export async function fetchExamSessions(params?: Record<string, string | undefined>) {
  const { data } = await api.get<ExamSession[]>('/v1/examinations/sessions', { params });
  return data;
}

export async function createExamSession(payload: Partial<ExamSession>) {
  const { data } = await api.post('/v1/examinations/sessions', payload);
  return data;
}

export async function updateExamSession(id: string, payload: Partial<ExamSession>) {
  const { data } = await api.patch(`/v1/examinations/sessions/${id}`, payload);
  return data;
}

export async function archiveExamSession(id: string) {
  const { data } = await api.delete(`/v1/examinations/sessions/${id}`);
  return data;
}

export async function fetchExamPapers(params?: Record<string, string | undefined>) {
  const { data } = await api.get<ExamPaper[]>('/v1/examinations/papers', { params });
  return data;
}

export async function createExamPaper(payload: Partial<ExamPaper>) {
  const { data } = await api.post('/v1/examinations/papers', payload);
  return data;
}

export async function updateExamPaper(id: string, payload: Partial<ExamPaper>) {
  const { data } = await api.patch(`/v1/examinations/papers/${id}`, payload);
  return data;
}

export async function fetchExamPaperDetails(id: string) {
  const { data } = await api.get(`/v1/examinations/papers/${id}`);
  return data;
}

export async function fetchExamMarkRoster(id: string) {
  const { data } = await api.get(`/v1/examinations/papers/${id}/marks`);
  return data;
}

export async function saveExamMarks(id: string, entries: ExamMarkPayload[]) {
  const { data } = await api.post(`/v1/examinations/papers/${id}/marks`, { entries });
  return data;
}

export async function calculateExamResults(sessionId: string) {
  const { data } = await api.post(`/v1/examinations/sessions/${sessionId}/calculate-results`);
  return data;
}

export async function publishExamResults(sessionId: string) {
  const { data } = await api.post(`/v1/examinations/sessions/${sessionId}/publish-results`);
  return data;
}

export async function fetchExamResults(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/examinations/results', { params });
  return data;
}

export async function fetchMyExamResults(sessionId?: string) {
  const { data } = await api.get('/v1/examinations/portal/results', {
    params: sessionId ? { sessionId } : undefined,
  });
  return data;
}

export async function fetchExamPrintData(
  type: string,
  params?: Record<string, string | undefined>,
) {
  const { data } = await api.get(`/v1/examinations/print/${type}`, { params });
  return data;
}

export async function fetchMyExamAdmitCard(sessionId?: string) {
  const { data } = await api.get('/v1/examinations/portal/admit-card', {
    params: sessionId ? { sessionId } : undefined,
  });
  return data;
}

export async function downloadExamExport(
  type: string,
  params?: Record<string, string | undefined>,
) {
  const { data } = await api.get(`/v1/examinations/export/${type}`, {
    params,
    responseType: 'blob',
  });
  return data as Blob;
}

export async function allocateExamRooms(id: string, payload: { roomIds?: string[] }) {
  const { data } = await api.post(`/v1/examinations/papers/${id}/allocate-rooms`, payload);
  return data;
}

export async function generateExamSeating(id: string, payload: { count?: number }) {
  const { data } = await api.post(`/v1/examinations/papers/${id}/generate-seating`, payload);
  return data;
}

export async function assignExamInvigilator(
  id: string,
  payload: { classroomId: string; staffProfileId: string; role?: string; remarks?: string },
) {
  const { data } = await api.post(`/v1/examinations/papers/${id}/invigilators`, payload);
  return data;
}

export async function fetchExamReport(type: string, params?: Record<string, string | undefined>) {
  const { data } = await api.get(`/v1/examinations/reports/${type}`, { params });
  return data;
}
