import { api } from '@/services/api';

const base = '/v1/short-term-courses';

export async function fetchStcDashboard() {
  const { data } = await api.get(`${base}/dashboard`);
  return data;
}

export async function seedStcDemoCourses() {
  const { data } = await api.post(`${base}/seed-demo`, {});
  return data;
}

export async function fetchStcCatalogue() {
  const { data } = await api.get(`${base}/catalogue`);
  return data;
}

export async function fetchStcCourses(status?: string) {
  const { data } = await api.get(`${base}/courses`, {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function createStcCourse(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/courses`, payload);
  return data;
}

export async function updateStcCourse(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`${base}/courses/${id}`, payload);
  return data;
}

export async function publishStcCourse(id: string) {
  const { data } = await api.post(`${base}/courses/${id}/publish`, {});
  return data;
}

export async function fetchStcBatches(courseId?: string) {
  const { data } = await api.get(`${base}/batches`, {
    params: courseId ? { courseId } : undefined,
  });
  return data;
}

export async function fetchStcBatch(id: string) {
  const { data } = await api.get(`${base}/batches/${id}`);
  return data;
}

export async function createStcBatch(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/batches`, payload);
  return data;
}

export async function assignStcStaff(
  batchId: string,
  payload: { staffUserId: string; role: string },
) {
  const { data } = await api.post(`${base}/batches/${batchId}/staff`, payload);
  return data;
}

export async function createStcSession(batchId: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/batches/${batchId}/sessions`, payload);
  return data;
}

export async function createStcMaterial(batchId: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/batches/${batchId}/materials`, payload);
  return data;
}

export async function createStcAssessment(batchId: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/batches/${batchId}/assessments`, payload);
  return data;
}

export async function gradeStcAssessment(
  assessmentId: string,
  payload: { enrollmentId: string; marks: number },
) {
  const { data } = await api.post(`${base}/assessments/${assessmentId}/grade`, payload);
  return data;
}

export async function markStcAttendance(
  sessionId: string,
  rows: Array<{ enrollmentId: string; status: string }>,
) {
  const { data } = await api.post(`${base}/sessions/${sessionId}/attendance`, { rows });
  return data;
}

export async function fetchStcEnrollments(params?: {
  batchId?: string;
  studentId?: string;
  status?: string;
}) {
  const { data } = await api.get(`${base}/enrollments`, { params });
  return data;
}

export async function applyStcEnrollment(batchId: string) {
  const { data } = await api.post(`${base}/enrollments/apply`, {
    batchId,
    acceptTerms: true,
  });
  return data;
}

export async function payStcEnrollment(enrollmentId: string) {
  const { data } = await api.post(`${base}/enrollments/${enrollmentId}/pay`, {});
  return data;
}

export async function confirmStcPayment(enrollmentId: string, paymentId?: string) {
  const { data } = await api.post(`${base}/enrollments/${enrollmentId}/confirm-payment`, {
    paymentId,
  });
  return data;
}

export async function fetchStcMyLearning() {
  const { data } = await api.get(`${base}/my-learning`);
  return data;
}

export async function fetchStcAttendanceSummary(enrollmentId: string) {
  const { data } = await api.get(`${base}/enrollments/${enrollmentId}/attendance`);
  return data;
}

export async function fetchStcCertEligibility(enrollmentId: string) {
  const { data } = await api.get(`${base}/enrollments/${enrollmentId}/certificate-eligibility`);
  return data;
}

export async function issueStcCertificate(enrollmentId: string) {
  const { data } = await api.post(`${base}/enrollments/${enrollmentId}/issue-certificate`, {});
  return data;
}
