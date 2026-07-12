import { apiFetch } from '@/api/client';

export type FeedbackScaleItem = { rating: number; label: string };

export type FeedbackOption = { value: string; label: string };

export type FeedbackCampaignQuestion = {
  id: string;
  prompt: string;
  description?: string | null;
  helpText?: string | null;
  placeholder?: string | null;
  category: string;
  required: boolean;
  sortOrder: number;
  questionType?: string;
  options?: FeedbackOption[] | unknown;
  validation?: unknown;
  conditionalLogic?: unknown;
};

export type FeedbackCampaignItem = {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
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
  questions?: FeedbackCampaignQuestion[];
};

export function fetchMyFeedbackCampaigns() {
  return apiFetch<{ scale: FeedbackScaleItem[]; items: FeedbackCampaignItem[] }>(
    '/v1/feedback/me/campaigns',
  );
}

export function submitMyFeedback(campaignId: string, answers: Array<Record<string, unknown>>) {
  return apiFetch(`/v1/feedback/me/campaigns/${campaignId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}
