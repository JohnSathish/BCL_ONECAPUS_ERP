import { apiFetch } from '@/api/client';

export type FeedbackScaleItem = { rating: number; label: string };

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
  questions?: Array<{
    id: string;
    prompt: string;
    category: string;
    required: boolean;
    sortOrder: number;
  }>;
};

export function fetchMyFeedbackCampaigns() {
  return apiFetch<{ scale: FeedbackScaleItem[]; items: FeedbackCampaignItem[] }>(
    '/v1/feedback/me/campaigns',
  );
}

export function submitMyFeedback(
  campaignId: string,
  answers: Array<{ questionId: string; rating: number }>,
) {
  return apiFetch(`/v1/feedback/me/campaigns/${campaignId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}
