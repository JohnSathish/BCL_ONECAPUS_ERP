import { api } from '@/services/api';
import type {
  FeeComponent,
  FeeDashboard,
  FeeDemandPreview,
  FeeStructure,
  StudentFeeLedger,
} from '@/types/fees';

export type FeeStructurePayload = {
  code: string;
  name: string;
  description?: string;
  category?: string;
  billingFrequency?: string;
  academicYearId?: string;
  semesterId?: string;
  streamId?: string;
  departmentId?: string;
  programVersionId?: string;
  shiftId?: string;
  components?: FeeComponent[];
};

export type FeeDemandScope = {
  studentId?: string;
  studentIds?: string[];
  academicYearId?: string;
  semesterId?: string;
  semesterNumber?: number;
  programVersionId?: string;
  departmentId?: string;
  streamId?: string;
  shiftId?: string;
  billingLayer?: string;
  billingPeriod?: string;
  demandType?: string;
  dueDate?: string;
  publish?: boolean;
};

export async function fetchFeeDashboard() {
  const { data } = await api.get('/v1/fees/dashboard');
  return data as FeeDashboard;
}

export async function fetchFeeStructures(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/fees/structures', { params });
  return data as FeeStructure[];
}

export async function createFeeStructure(payload: FeeStructurePayload) {
  const { data } = await api.post('/v1/fees/structures', payload);
  return data as FeeStructure;
}

export async function publishFeeStructure(id: string) {
  const { data } = await api.post(`/v1/fees/structures/${id}/publish`, {});
  return data as FeeStructure;
}

export async function previewFeeDemand(payload: FeeDemandScope) {
  const { data } = await api.post('/v1/fees/demands/preview', payload);
  return data as FeeDemandPreview;
}

export async function generateFeeDemand(payload: FeeDemandScope) {
  const { data } = await api.post('/v1/fees/demands/generate', payload);
  return data as { createdCount: number; skippedCount: number; totalAmount: number };
}

export async function previewRenewal(payload: FeeDemandScope) {
  const { data } = await api.post('/v1/fees/renewals/preview', payload);
  return data as FeeDemandPreview;
}

export async function generateRenewal(payload: FeeDemandScope) {
  const { data } = await api.post('/v1/fees/renewals/generate', payload);
  return data as { createdCount: number; skippedCount: number; totalAmount: number };
}

export async function fetchStudentFeeLedger(studentId: string) {
  const { data } = await api.get(`/v1/fees/students/${studentId}/ledger`);
  return data as StudentFeeLedger;
}

export async function fetchMyFeeLedger() {
  const { data } = await api.get('/v1/fees/me/ledger');
  return data as StudentFeeLedger;
}

export async function collectFee(payload: {
  studentId: string;
  demandIds?: string[];
  amount: number;
  paymentMode: string;
  provider?: string;
}) {
  const { data } = await api.post('/v1/fees/collections', payload);
  return data;
}

export async function initiateOnlinePayment(payload: {
  studentId: string;
  demandIds?: string[];
  amount: number;
  provider: 'RAZORPAY' | 'CASHFREE' | 'PAYU' | 'CUSTOM';
}) {
  const { data } = await api.post('/v1/fees/payments/initiate', payload);
  return data;
}

export async function fetchFeeReport(type: string, params?: Record<string, string | undefined>) {
  const { data } = await api.get(`/v1/fees/reports/${type}`, { params });
  return data;
}
