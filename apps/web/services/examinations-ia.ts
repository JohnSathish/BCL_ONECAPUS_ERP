import { api } from '@/services/api';

export type IaSettings = {
  legacyUniversityExamMode: boolean;
  iaPassMarkPercent: number;
  attendanceMinPercent: number;
  blockAdmitOnDefaulter: boolean;
};

export type IaComponent = {
  id?: string;
  code: string;
  label: string;
  maxMarks: number;
  weightage?: number;
  isMandatory?: boolean;
  sortOrder?: number;
};

export type IaScheme = {
  id: string;
  name: string;
  semesterNo?: number | null;
  totalMaxMarks: number;
  passMark?: number | null;
  status: string;
  isLocked: boolean;
  components: IaComponent[];
};

export type IaSession = {
  id: string;
  name: string;
  examType: string;
  semesterNo?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
};

export type IaPaper = {
  id: string;
  sessionId: string;
  courseId?: string | null;
  paperCode: string;
  paperName: string;
  examDate: string;
  startTime: string;
  endTime: string;
  semesterNo?: number | null;
  status: string;
};

export type IaMarkRow = {
  studentId: string;
  componentId: string;
  marks?: number | null;
  isAbsent?: boolean;
  remarks?: string;
};

export async function fetchIaSettings() {
  const { data } = await api.get<IaSettings>('/v1/examinations/ia/settings');
  return data;
}

export async function updateIaSettings(payload: Partial<IaSettings>) {
  const { data } = await api.patch('/v1/examinations/ia/settings', payload);
  return data;
}

export async function fetchIaAdminDashboard() {
  const { data } = await api.get('/v1/examinations/ia/dashboard/admin');
  return data;
}

export async function fetchIaPrincipalDashboard() {
  const { data } = await api.get('/v1/examinations/ia/dashboard/principal');
  return data;
}

export async function fetchIaSchemes(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<IaScheme[]>('/v1/examinations/ia/schemes', { params });
  return data;
}

export async function createIaScheme(payload: {
  name: string;
  semesterNo?: number;
  totalMaxMarks?: number;
  passMark?: number;
  components?: IaComponent[];
}) {
  const { data } = await api.post('/v1/examinations/ia/schemes', payload);
  return data;
}

export async function fetchIaSessions(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<IaSession[]>('/v1/examinations/ia/sessions', { params });
  return data;
}

export type CreateIaSessionPayload = {
  name: string;
  examType: string;
  academicYearId?: string;
  shiftId?: string;
  semesterNo?: number;
  startDate?: string;
  endDate?: string;
  instructions?: string;
};

export async function createIaSession(payload: CreateIaSessionPayload) {
  const { data } = await api.post('/v1/examinations/ia/sessions', payload);
  return data;
}

export async function fetchIaPapers(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<IaPaper[]>('/v1/examinations/ia/papers', { params });
  return data;
}

export async function createIaPaper(payload: Partial<IaPaper> & { sessionId: string }) {
  const { data } = await api.post('/v1/examinations/ia/papers', payload);
  return data;
}

export async function fetchFacultyIaSubjects() {
  const { data } = await api.get('/v1/examinations/ia/faculty/my-subjects');
  return data;
}

export type IaExamSummary = IaSession & {
  metadata?: {
    programmeName?: string;
    programmeCode?: string;
    maxMarks?: number;
  };
  stats?: {
    subjectsScheduled: number;
    expectedRegistrations: number;
  };
};

export type CreateIaExamPayload = {
  name: string;
  semesterNo: number;
  programVersionId: string;
  departmentId?: string;
  academicYearId?: string;
  examType: string;
  maxMarks: number;
  startDate?: string;
  endDate?: string;
  remarks?: string;
};

export async function fetchIaExams() {
  const { data } = await api.get<IaExamSummary[]>('/v1/examinations/ia/exams');
  return data;
}

export async function createIaExam(payload: CreateIaExamPayload) {
  const { data } = await api.post('/v1/examinations/ia/exams', payload);
  return data as {
    session: IaSession;
    summary: {
      subjectsLoaded: number;
      papersCreated: number;
      schemesCreated: number;
      studentsRegistered: number;
      programme?: string;
      semesterNo: number;
      maxMarks: number;
    };
  };
}

export async function generateIaTimetable(payload: {
  sessionId: string;
  startDate: string;
  durationMinutes?: number;
  defaultStartTime?: string;
}) {
  const { data } = await api.post('/v1/examinations/ia/exams/generate-timetable', payload);
  return data as { updated: number };
}

export async function fetchIaRoster(paperId: string, schemeId?: string) {
  const { data } = await api.get(`/v1/examinations/ia/papers/${paperId}/roster`, {
    params: schemeId ? { schemeId } : undefined,
  });
  return data;
}

export async function saveIaMarks(
  paperId: string,
  payload: { schemeId: string; rows: IaMarkRow[] },
) {
  const { data } = await api.post(`/v1/examinations/ia/papers/${paperId}/marks`, payload);
  return data;
}

export async function importIaMarks(
  paperId: string,
  payload: {
    schemeId: string;
    rows: Array<{ rollNumber: string; componentCode: string; marks: number }>;
  },
) {
  const { data } = await api.post(`/v1/examinations/ia/papers/${paperId}/marks/import`, payload);
  return data;
}

export async function fetchIaConsolidationSheets() {
  const { data } = await api.get('/v1/examinations/ia/consolidation');
  return data;
}

export async function generateIaConsolidation(payload: {
  name: string;
  semesterNo?: number;
  departmentId?: string;
  sessionId?: string;
}) {
  const { data } = await api.post('/v1/examinations/ia/consolidation/generate', payload);
  return data;
}

export async function fetchIaConsolidationSheet(id: string) {
  const { data } = await api.get(`/v1/examinations/ia/consolidation/${id}`);
  return data;
}

export async function submitIaSheet(id: string) {
  const { data } = await api.post(`/v1/examinations/ia/sheets/${id}/submit`);
  return data;
}

export async function actOnIaApproval(
  id: string,
  payload: { action: 'APPROVE' | 'REJECT'; remarks?: string },
) {
  const { data } = await api.post(`/v1/examinations/ia/approvals/${id}/action`, payload);
  return data;
}

export async function fetchPendingIaApprovals() {
  const { data } = await api.get('/v1/examinations/ia/approvals/pending');
  return data;
}

export async function fetchIaDefaulters() {
  const { data } = await api.get('/v1/examinations/ia/defaulters');
  return data;
}

export async function fetchStudentIaSchedule() {
  const { data } = await api.get('/v1/examinations/ia/portal/schedule');
  return data;
}

export async function fetchStudentIaMarks() {
  const { data } = await api.get('/v1/examinations/ia/portal/marks');
  return data;
}

export async function fetchStudentIaPerformance() {
  const { data } = await api.get('/v1/examinations/ia/portal/performance');
  return data;
}

export async function fetchIaAdmitSessions() {
  const { data } = await api.get('/v1/examinations/ia/admit-cards/sessions');
  return data;
}

export async function fetchIaAdmitDashboard(
  sessionId: string,
  filters?: { programmeCode?: string; departmentId?: string; semesterNo?: number },
) {
  const { data } = await api.get(
    `/v1/examinations/ia/admit-cards/sessions/${sessionId}/dashboard`,
    {
      params: filters,
    },
  );
  return data;
}

export async function fetchIaAdmitStudents(
  sessionId: string,
  filters?: { programmeCode?: string; departmentId?: string },
) {
  const { data } = await api.get(`/v1/examinations/ia/admit-cards/sessions/${sessionId}/students`, {
    params: filters,
  });
  return data;
}

export async function fetchIaAdmitCard(
  sessionId: string,
  studentId: string,
  options?: { preview?: boolean },
) {
  const { data } = await api.get(
    `/v1/examinations/ia/admit-cards/sessions/${sessionId}/students/${studentId}`,
    { params: options?.preview ? { preview: '1' } : undefined },
  );
  return data;
}

export async function bulkGenerateIaAdmitCards(sessionId: string, studentIds: string[]) {
  const { data } = await api.post('/v1/examinations/ia/admit-cards/bulk', {
    sessionId,
    studentIds,
  });
  return data;
}

export async function downloadIaAdmitPdf(sessionId: string, studentIds: string[]) {
  const { data } = await api.post(
    '/v1/examinations/ia/admit-cards/export/pdf',
    { sessionId, studentIds },
    { responseType: 'blob' },
  );
  return data as Blob;
}

export async function downloadIaAdmitZip(sessionId: string, studentIds: string[]) {
  const { data } = await api.post(
    '/v1/examinations/ia/admit-cards/export/zip',
    { sessionId, studentIds },
    { responseType: 'blob' },
  );
  return data as Blob;
}

export async function verifyIaAdmitCard(token: string) {
  const { data } = await api.get(`/v1/examinations/ia/admit-card/verify/${token}`);
  return data;
}

export async function fetchIaAdmitIneligibleReport(sessionId: string) {
  const { data } = await api.get(
    `/v1/examinations/ia/admit-cards/sessions/${sessionId}/ineligible`,
  );
  return data;
}

export async function fetchIaAdmitAudit(sessionId: string) {
  const { data } = await api.get(`/v1/examinations/ia/admit-cards/sessions/${sessionId}/audit`);
  return data;
}

export async function fetchStudentIaAdmitCard(sessionId?: string) {
  const { data } = await api.get('/v1/examinations/ia/portal/admit-card', {
    params: sessionId ? { sessionId } : undefined,
  });
  return data;
}

export async function downloadIaNehuExport(
  sheetId: string,
  format: 'xlsx' | 'csv' | 'pdf' = 'xlsx',
): Promise<Blob> {
  const { data } = await api.get(`/v1/examinations/ia/nehu-export/${sheetId}`, {
    params: { format },
    responseType: 'blob',
  });
  return data as Blob;
}
