import { api } from './api';

export type LmsWorkspace = {
  id: string;
  title: string;
  workspaceType: string;
  semesterNo: number;
  status: string;
  course: { code: string; title: string; credits: string | number };
  offeringSection?: { sectionCode: string } | null;
  _count?: { materials: number; announcements: number; lessonPlans: number };
};

export type LmsMaterial = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  unit?: string | null;
  visibility: string;
  filePath?: string | null;
  externalUrl?: string | null;
  mimeType?: string | null;
  status: string;
  bookmarked?: boolean;
  uploadedBy?: { displayName: string | null; email: string };
};

export type LmsAnnouncement = {
  id: string;
  title: string;
  body: string;
  type: string;
  pinned: boolean;
  publishAt: string;
  workspace?: { id: string; title: string } | null;
};

export type LmsLessonPlan = {
  id: string;
  unit: string;
  topic: string;
  subtopic?: string | null;
  status: string;
  expectedHours?: string | number | null;
  scheduledDate?: string | null;
};

export type LmsSettings = {
  maxUploadMb: number;
  allowedMimeTypes: string[];
  poolWorkspacesEnabled: boolean;
  defaultVisibility: string;
  featureFlags: Record<string, boolean>;
};

export async function fetchLmsAdminDashboard() {
  const { data } = await api.get('/v1/lms/dashboard/admin');
  return data;
}

export async function fetchLmsSettings() {
  const { data } = await api.get('/v1/lms/settings');
  return data as LmsSettings;
}

export async function updateLmsSettings(payload: Partial<LmsSettings>) {
  const { data } = await api.patch('/v1/lms/settings', payload);
  return data as LmsSettings;
}

export async function provisionLmsWorkspaces() {
  const { data } = await api.post('/v1/lms/workspaces/provision');
  return data;
}

export async function fetchLmsWorkspaces(params?: {
  semesterNo?: number;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get('/v1/lms/workspaces', { params });
  return data as {
    data: LmsWorkspace[];
    meta: { page: number; total: number; totalPages: number };
  };
}

export async function fetchLmsWorkspace(id: string) {
  const { data } = await api.get(`/v1/lms/workspaces/${id}`);
  return data;
}

export async function fetchLmsWorkspaceMaterials(
  workspaceId: string,
  params?: { q?: string; category?: string },
) {
  const { data } = await api.get(`/v1/lms/workspaces/${workspaceId}/materials`, { params });
  return data as LmsMaterial[];
}

export async function uploadLmsMaterial(workspaceId: string, form: FormData) {
  const { data } = await api.post(`/v1/lms/workspaces/${workspaceId}/materials`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as LmsMaterial;
}

export async function publishLmsMaterial(materialId: string) {
  const { data } = await api.post(`/v1/lms/materials/${materialId}/publish`);
  return data;
}

export async function fetchLmsAnnouncements(workspaceId?: string) {
  const { data } = await api.get('/v1/lms/announcements', { params: { workspaceId } });
  return data as LmsAnnouncement[];
}

export async function createLmsAnnouncement(payload: {
  title: string;
  body: string;
  workspaceId?: string;
  type?: string;
  pinned?: boolean;
}) {
  if (payload.workspaceId) {
    const { data } = await api.post(
      `/v1/lms/workspaces/${payload.workspaceId}/announcements`,
      payload,
    );
    return data;
  }
  const { data } = await api.post('/v1/lms/announcements', payload);
  return data;
}

export async function fetchLmsLessonPlans(workspaceId: string) {
  const { data } = await api.get(`/v1/lms/workspaces/${workspaceId}/lesson-plans`);
  return data as LmsLessonPlan[];
}

export async function createLmsLessonPlan(workspaceId: string, payload: Partial<LmsLessonPlan>) {
  const { data } = await api.post(`/v1/lms/workspaces/${workspaceId}/lesson-plans`, payload);
  return data;
}

export async function fetchLmsMyWorkspaces() {
  const { data } = await api.get('/v1/lms/me/workspaces');
  return data as { role: string; workspaces: LmsWorkspace[]; progress?: Record<string, unknown> };
}

export async function fetchLmsMyDashboard() {
  const { data } = await api.get('/v1/lms/me/dashboard');
  return data;
}

export async function fetchLmsWorkspaceAttendance(workspaceId: string) {
  const { data } = await api.get(`/v1/lms/workspaces/${workspaceId}/attendance`);
  return data;
}

export async function searchLms(q: string) {
  const { data } = await api.get('/v1/lms/search', { params: { q } });
  return data;
}

export async function bookmarkLmsMaterial(materialId: string) {
  const { data } = await api.post(`/v1/lms/materials/${materialId}/bookmark`);
  return data as { bookmarked: boolean };
}

export async function downloadLmsMaterial(materialId: string) {
  const { data } = await api.post(`/v1/lms/materials/${materialId}/download`);
  return data as { filePath?: string; externalUrl?: string; title: string };
}

export type LmsAssignment = {
  id: string;
  title: string;
  instructions?: string | null;
  submissionType: string;
  maxMarks?: string | number | null;
  dueAt?: string | null;
  allowLateSubmission: boolean;
  status: string;
  publishedAt?: string | null;
  _count?: { submissions: number };
  mySubmission?: LmsAssignmentSubmission | null;
};

export type LmsAssignmentSubmission = {
  id: string;
  status: string;
  textContent?: string | null;
  linkUrl?: string | null;
  filePath?: string | null;
  attemptNo: number;
  submittedAt?: string | null;
  feedback?: LmsAssignmentFeedback[];
  student?: {
    id: string;
    enrollmentNumber: string | null;
    masterProfile?: { fullName: string } | null;
  };
};

export type LmsAssignmentFeedback = {
  id: string;
  action: string;
  marksAwarded?: string | number | null;
  feedbackText?: string | null;
  createdAt: string;
};

export async function fetchLmsAssignments(workspaceId: string) {
  const { data } = await api.get(`/v1/lms/workspaces/${workspaceId}/assignments`);
  return data as LmsAssignment[];
}

export async function createLmsAssignment(workspaceId: string, payload: Partial<LmsAssignment>) {
  const { data } = await api.post(`/v1/lms/workspaces/${workspaceId}/assignments`, payload);
  return data as LmsAssignment;
}

export async function publishLmsAssignment(assignmentId: string) {
  const { data } = await api.post(`/v1/lms/assignments/${assignmentId}/publish`);
  return data as LmsAssignment;
}

export async function closeLmsAssignment(assignmentId: string) {
  const { data } = await api.post(`/v1/lms/assignments/${assignmentId}/close`);
  return data as LmsAssignment;
}

export async function fetchLmsAssignmentSubmissions(assignmentId: string) {
  const { data } = await api.get(`/v1/lms/assignments/${assignmentId}/submissions`);
  return data as LmsAssignmentSubmission[];
}

export async function fetchLmsMySubmission(assignmentId: string) {
  const { data } = await api.get(`/v1/lms/assignments/${assignmentId}/my-submission`);
  return data as LmsAssignmentSubmission | null;
}

export async function submitLmsAssignment(assignmentId: string, form: FormData) {
  const { data } = await api.post(`/v1/lms/assignments/${assignmentId}/submit`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as LmsAssignmentSubmission;
}

export async function evaluateLmsSubmission(
  submissionId: string,
  payload: { marksAwarded?: number; feedbackText?: string },
) {
  const { data } = await api.post(`/v1/lms/submissions/${submissionId}/evaluate`, payload);
  return data as LmsAssignmentSubmission;
}

export async function returnLmsSubmission(submissionId: string, feedbackText: string) {
  const { data } = await api.post(`/v1/lms/submissions/${submissionId}/return`, { feedbackText });
  return data as LmsAssignmentSubmission;
}

export type LmsQuiz = {
  id: string;
  title: string;
  instructions?: string | null;
  timeLimitMinutes?: number | null;
  maxAttempts: number;
  maxMarks?: string | number | null;
  status: string;
  dueAt?: string | null;
  _count?: { questions: number; attempts: number };
  myAttempt?: LmsQuizAttempt | null;
};

export type LmsQuizQuestion = {
  id: string;
  prompt: string;
  questionType: string;
  options: string[];
  marks: string | number;
  sortOrder: number;
  correctAnswer?: string;
};

export type LmsQuizAttempt = {
  id: string;
  status: string;
  score?: string | number | null;
  maxScore?: string | number | null;
  attemptNo: number;
  submittedAt?: string | null;
};

export async function fetchLmsQuizzes(workspaceId: string) {
  const { data } = await api.get(`/v1/lms/workspaces/${workspaceId}/quizzes`);
  return data as LmsQuiz[];
}

export async function createLmsQuiz(workspaceId: string, payload: Partial<LmsQuiz>) {
  const { data } = await api.post(`/v1/lms/workspaces/${workspaceId}/quizzes`, payload);
  return data as LmsQuiz;
}

export async function addLmsQuizQuestion(quizId: string, payload: Partial<LmsQuizQuestion>) {
  const { data } = await api.post(`/v1/lms/quizzes/${quizId}/questions`, payload);
  return data as LmsQuizQuestion;
}

export async function publishLmsQuiz(quizId: string) {
  const { data } = await api.post(`/v1/lms/quizzes/${quizId}/publish`);
  return data as LmsQuiz;
}

export async function closeLmsQuiz(quizId: string) {
  const { data } = await api.post(`/v1/lms/quizzes/${quizId}/close`);
  return data as LmsQuiz;
}

export async function fetchLmsQuizQuestions(quizId: string) {
  const { data } = await api.get(`/v1/lms/quizzes/${quizId}/questions`);
  return data as LmsQuizQuestion[];
}

export async function startLmsQuizAttempt(quizId: string) {
  const { data } = await api.post(`/v1/lms/quizzes/${quizId}/start`);
  return data as {
    attempt: LmsQuizAttempt;
    timeLimitMinutes?: number | null;
    questions: LmsQuizQuestion[];
  };
}

export async function submitLmsQuizAttempt(
  attemptId: string,
  answers: Array<{ questionId: string; answer: string }>,
) {
  const { data } = await api.post(`/v1/lms/quiz-attempts/${attemptId}/submit`, { answers });
  return data as LmsQuizAttempt;
}

export async function fetchLmsQuizAttempts(quizId: string) {
  const { data } = await api.get(`/v1/lms/quizzes/${quizId}/attempts`);
  return data as Array<
    LmsQuizAttempt & {
      student?: { enrollmentNumber?: string; masterProfile?: { fullName: string } };
    }
  >;
}

export type LmsDiscussion = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  status: string;
  createdAt: string;
  createdBy?: { displayName?: string; email?: string };
  _count?: { replies: number };
};

export type LmsDiscussionReply = {
  id: string;
  body: string;
  createdAt: string;
  createdBy?: { displayName?: string; email?: string };
};

export async function fetchLmsDiscussions(workspaceId: string) {
  const { data } = await api.get(`/v1/lms/workspaces/${workspaceId}/discussions`);
  return data as LmsDiscussion[];
}

export async function createLmsDiscussion(
  workspaceId: string,
  payload: { title: string; body: string; pinned?: boolean },
) {
  const { data } = await api.post(`/v1/lms/workspaces/${workspaceId}/discussions`, payload);
  return data as LmsDiscussion;
}

export async function fetchLmsDiscussionReplies(discussionId: string) {
  const { data } = await api.get(`/v1/lms/discussions/${discussionId}/replies`);
  return data as LmsDiscussionReply[];
}

export async function replyLmsDiscussion(discussionId: string, body: string) {
  const { data } = await api.post(`/v1/lms/discussions/${discussionId}/replies`, { body });
  return data as LmsDiscussionReply;
}
