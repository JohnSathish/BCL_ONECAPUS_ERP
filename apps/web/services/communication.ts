import { api } from '@/services/api';
import type {
  CommunicationAnalytics,
  CommunicationApproval,
  CommunicationAutomationRule,
  CommunicationCampaign,
  CommunicationDashboard,
  CommunicationRecipient,
  CommunicationSettings,
  CommunicationTemplate,
  DeliveryLog,
  ResolvedRecipient,
  UserNotification,
} from '@/types/communication';

const base = '/v1/communication';

export const fetchCommunicationDashboard = () =>
  api.get<CommunicationDashboard>(`${base}/dashboard`).then((res) => res.data);

export const fetchChannelHealth = () =>
  api
    .get<CommunicationDashboard['channelHealth']>(`${base}/channel-health`)
    .then((res) => res.data);

export const fetchCommunicationAnalytics = (from?: string, to?: string) =>
  api
    .get<CommunicationAnalytics>(`${base}/analytics`, { params: { from, to } })
    .then((res) => res.data);

export const fetchCommunicationSettings = () =>
  api.get<CommunicationSettings>(`${base}/settings`).then((res) => res.data);

export const saveCommunicationSettings = (payload: Partial<CommunicationSettings>) =>
  api.post<CommunicationSettings>(`${base}/settings`, payload).then((res) => res.data);

export const fetchAutomationRules = () =>
  api.get<CommunicationAutomationRule[]>(`${base}/automation-rules`).then((res) => res.data);

export const seedAutomationRules = () =>
  api.post(`${base}/automation-rules/seed-defaults`).then((res) => res.data);

export const toggleAutomationRule = (id: string, isEnabled: boolean) =>
  api.patch(`${base}/automation-rules/${id}/toggle`, { isEnabled }).then((res) => res.data);

export const fetchApprovals = (status?: string) =>
  api
    .get<CommunicationApproval[]>(`${base}/approvals`, { params: status ? { status } : undefined })
    .then((res) => res.data);

export const submitApproval = (campaignId: string) =>
  api.post(`${base}/approvals/submit/${campaignId}`).then((res) => res.data);

export const approveMessage = (id: string, note?: string) =>
  api.post(`${base}/approvals/${id}/approve`, { note }).then((res) => res.data);

export const rejectMessage = (id: string, note?: string) =>
  api.post(`${base}/approvals/${id}/reject`, { note }).then((res) => res.data);

export const fetchWhatsAppTemplates = () =>
  api.get(`${base}/whatsapp/templates`).then((res) => res.data);

export const testEmailChannel = (to: string, subject?: string) =>
  api.post(`${base}/channels/email/test`, { to, subject }).then((res) => res.data);

export const exportCommunicationReport = (params: Record<string, string | undefined>) =>
  api
    .get<string>(`${base}/reports/export`, {
      params: { ...params, format: 'csv' },
      responseType: 'text',
    })
    .then((res) => res.data);

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

export const cancelCommunicationCampaign = (id: string) =>
  api.post(`${base}/campaigns/${id}/cancel`).then((res) => res.data);

export const fetchCampaignRecipients = (id: string) =>
  api.get<CommunicationRecipient[]>(`${base}/campaigns/${id}/recipients`).then((res) => res.data);

export const fetchDeliveryLogs = (params?: Record<string, string | number | undefined>) =>
  api.get<DeliveryLog[]>(`${base}/delivery-logs`, { params }).then((res) => res.data);

export const retryDeliveryLog = (id: string) =>
  api.post(`${base}/delivery-logs/${id}/retry`).then((res) => res.data);

export const fetchAudienceSegments = () =>
  api.get(`${base}/audience-segments`).then((res) => res.data);

export const createAudienceSegment = (payload: {
  name: string;
  audienceType: string;
  filters: Record<string, unknown>;
}) => api.post(`${base}/audience-segments`, payload).then((res) => res.data);

export const deleteAudienceSegment = (id: string) =>
  api.delete(`${base}/audience-segments/${id}`).then((res) => res.data);

export const fetchNotifications = (limit = 30, filter?: 'all' | 'unread' | 'archived') =>
  api
    .get<UserNotification[]>(`${base}/notifications`, { params: { limit, filter } })
    .then((res) => res.data);

export const fetchUnreadNotificationCount = () =>
  api.get<{ count: number }>(`${base}/notifications/unread-count`).then((res) => res.data);

export const markNotificationRead = (id: string) =>
  api.post(`${base}/notifications/${id}/read`).then((res) => res.data);

export const dismissNotification = (id: string) =>
  api.post(`${base}/notifications/${id}/dismiss`).then((res) => res.data);

export const archiveNotification = (id: string) =>
  api.post(`${base}/notifications/${id}/archive`).then((res) => res.data);

export const markAllNotificationsRead = () =>
  api.post(`${base}/notifications/read-all`).then((res) => res.data);

export const fetchNotificationPreferences = () =>
  api.get(`${base}/notifications/preferences`).then((res) => res.data);

export const saveNotificationPreference = (channel: string, enabled: boolean) =>
  api.post(`${base}/notifications/preferences`, { channel, enabled }).then((res) => res.data);
