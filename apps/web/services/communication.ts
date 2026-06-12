import { api } from '@/services/api';
import type {
  CommunicationCampaign,
  CommunicationDashboard,
  CommunicationRecipient,
  CommunicationTemplate,
  DeliveryLog,
  ResolvedRecipient,
  UserNotification,
} from '@/types/communication';

const base = '/v1/communication';

export const fetchCommunicationDashboard = () =>
  api.get<CommunicationDashboard>(`${base}/dashboard`).then((res) => res.data);

export const fetchCommunicationTemplates = (category?: string) =>
  api
    .get<
      CommunicationTemplate[]
    >(`${base}/templates`, { params: category ? { category } : undefined })
    .then((res) => res.data);

export const seedCommunicationTemplates = () =>
  api.post<CommunicationTemplate[]>(`${base}/templates/seed-defaults`).then((res) => res.data);

export const createCommunicationTemplate = (payload: Partial<CommunicationTemplate>) =>
  api.post<CommunicationTemplate>(`${base}/templates`, payload).then((res) => res.data);

export const updateCommunicationTemplate = (id: string, payload: Partial<CommunicationTemplate>) =>
  api.patch<CommunicationTemplate>(`${base}/templates/${id}`, payload).then((res) => res.data);

export const deleteCommunicationTemplate = (id: string) =>
  api.delete(`${base}/templates/${id}`).then((res) => res.data);

export const fetchCommunicationCampaigns = (status?: string) =>
  api
    .get<CommunicationCampaign[]>(`${base}/campaigns`, { params: status ? { status } : undefined })
    .then((res) => res.data);

export const createCommunicationCampaign = (payload: Record<string, unknown>) =>
  api.post<CommunicationCampaign>(`${base}/campaigns`, payload).then((res) => res.data);

export const previewCommunicationAudience = (payload: {
  audienceType: string;
  audienceFilter?: Record<string, unknown>;
}) =>
  api
    .post<ResolvedRecipient[]>(`${base}/campaigns/preview-audience`, payload)
    .then((res) => res.data);

export const sendCommunicationCampaign = (id: string) =>
  api
    .post<{
      campaignId: string;
      recipientCount: number;
      status: string;
    }>(`${base}/campaigns/${id}/send`)
    .then((res) => res.data);

export const fetchCampaignRecipients = (id: string) =>
  api.get<CommunicationRecipient[]>(`${base}/campaigns/${id}/recipients`).then((res) => res.data);

export const fetchDeliveryLogs = (params?: Record<string, string | number | undefined>) =>
  api.get<DeliveryLog[]>(`${base}/delivery-logs`, { params }).then((res) => res.data);

export const fetchNotifications = (limit = 30) =>
  api
    .get<UserNotification[]>(`${base}/notifications`, { params: { limit } })
    .then((res) => res.data);

export const fetchUnreadNotificationCount = () =>
  api.get<{ count: number }>(`${base}/notifications/unread-count`).then((res) => res.data);

export const markNotificationRead = (id: string) =>
  api.post(`${base}/notifications/${id}/read`).then((res) => res.data);

export const markAllNotificationsRead = () =>
  api.post(`${base}/notifications/read-all`).then((res) => res.data);
