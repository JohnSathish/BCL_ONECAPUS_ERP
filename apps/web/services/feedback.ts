import { api } from '@/services/api';
import type {
  FeedbackAnswerValue,
  FeedbackQuestionDto,
} from '@/components/feedback/feedback-question-types';

const base = '/v1/feedback';

export type FeedbackScaleItem = { rating: number; label: string };

export type FeedbackSubmitAnswer = {
  questionId: string;
  rating?: number;
  valueText?: string;
  valueNumber?: number;
  valueBool?: boolean;
  valueDate?: string;
  valueJson?: unknown;
} & Partial<FeedbackAnswerValue>;

export async function fetchFeedbackScale() {
  const { data } = await api.get(`${base}/scale`);
  return data as FeedbackScaleItem[];
}

export async function fetchMyFeedbackCampaigns(audience?: string) {
  const { data } = await api.get(`${base}/me/campaigns`, {
    params: audience ? { audience } : undefined,
  });
  return data as {
    scale: FeedbackScaleItem[];
    audiences?: string[];
    items: Array<{
      id: string;
      title: string;
      description?: string | null;
      instructions?: string | null;
      audience?: string;
      academicYear: string;
      enabled: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      status: string;
      isOpen: boolean;
      alreadySubmitted: boolean;
      submittedAt?: string | null;
      questionCount: number;
      canSubmit: boolean;
      closedReason?: string | null;
      questions?: FeedbackQuestionDto[];
    }>;
  };
}

export async function submitMyFeedback(
  campaignId: string,
  answers: Array<Record<string, unknown>> | FeedbackSubmitAnswer[],
) {
  const { data } = await api.post(`${base}/me/campaigns/${campaignId}/submit`, { answers });
  return data;
}

export async function fetchFeedbackCampaigns(audience?: string) {
  const { data } = await api.get(`${base}/campaigns`, {
    params: audience ? { audience } : undefined,
  });
  return data;
}

export async function createFeedbackCampaign(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/campaigns`, payload);
  return data;
}

export async function updateFeedbackCampaign(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`${base}/campaigns/${id}`, payload);
  return data;
}

export async function deleteFeedbackCampaign(id: string) {
  const { data } = await api.delete(`${base}/campaigns/${id}`);
  return data;
}

export async function replaceFeedbackQuestions(
  id: string,
  questions: Array<Record<string, unknown>>,
) {
  const { data } = await api.post(`${base}/campaigns/${id}/questions`, { questions });
  return data;
}

export async function seedFeedbackStudentDefaults(id: string) {
  const { data } = await api.post(`${base}/campaigns/${id}/seed-student-defaults`);
  return data;
}

export async function seedFeedbackDefaults(id: string) {
  const { data } = await api.post(`${base}/campaigns/${id}/seed-defaults`);
  return data;
}

export async function fetchFeedbackResponses(id: string) {
  const { data } = await api.get(`${base}/campaigns/${id}/responses`);
  return data;
}

export async function fetchFeedbackAnalytics(id: string) {
  const { data } = await api.get(`${base}/campaigns/${id}/analytics`);
  return data;
}

export async function downloadFeedbackExportXlsx(id: string) {
  const { downloadBlob, filenameFromContentDisposition } = await import('@/utils/download-blob');
  const res = await api.get(`${base}/campaigns/${id}/export.xlsx`, { responseType: 'blob' });
  const filename =
    filenameFromContentDisposition(res.headers?.['content-disposition']) ||
    `feedback-export-${id}.xlsx`;
  downloadBlob(res.data as Blob, filename);
}

export async function downloadFeedbackExportPdf(id: string) {
  const { downloadBlob, filenameFromContentDisposition } = await import('@/utils/download-blob');
  const res = await api.get(`${base}/campaigns/${id}/export.pdf`, { responseType: 'blob' });
  const filename =
    filenameFromContentDisposition(res.headers?.['content-disposition']) ||
    `feedback-export-${id}.pdf`;
  downloadBlob(res.data as Blob, filename);
}
