import { apiFetch } from '@/api/client';

const base = '/v1/short-term-courses';

export type StcCourseCard = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  description: string;
  durationDays: number;
  mode: string;
  maxSeats: number;
  feeType: string;
  fees?: { courseFee?: number };
  registrationOpen?: boolean;
  openBatch?: { id: string } | null;
  seats?: { available: number; maxSeats: number };
};

export type StcEnrollment = {
  id: string;
  status: string;
  batch?: {
    batchCode?: string;
    course?: { name?: string; code?: string };
  };
  certificate?: { id: string } | null;
};

export function fetchStcMyLearning() {
  return apiFetch<{ catalogue: StcCourseCard[]; enrollments: StcEnrollment[] }>(
    `${base}/my-learning`,
  );
}

export function applyStcEnrollment(batchId: string) {
  return apiFetch<{
    enrollment: StcEnrollment;
    checkout: any;
    waitlisted?: boolean;
  }>(`${base}/enrollments/apply`, {
    method: 'POST',
    body: JSON.stringify({ batchId, acceptTerms: true }),
  });
}

export function payStcEnrollment(enrollmentId: string) {
  return apiFetch<{ enrollment: StcEnrollment; checkout: any }>(
    `${base}/enrollments/${enrollmentId}/pay`,
    { method: 'POST', body: '{}' },
  );
}

export function confirmStcPayment(enrollmentId: string, paymentId?: string) {
  return apiFetch(`${base}/enrollments/${enrollmentId}/confirm-payment`, {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
  });
}

export function fetchStcAttendanceSummary(enrollmentId: string) {
  return apiFetch<{ sessions: number; present: number; percent: number }>(
    `${base}/enrollments/${enrollmentId}/attendance`,
  );
}

export function fetchStcCertEligibility(enrollmentId: string) {
  return apiFetch<{ eligible: boolean; reason?: string }>(
    `${base}/enrollments/${enrollmentId}/certificate-eligibility`,
  );
}
