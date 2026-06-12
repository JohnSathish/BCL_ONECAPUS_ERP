export type CommunicationTemplate = {
  id: string;
  code: string;
  name: string;
  category: string;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  variables: string[];
  channels: string[];
  isActive: boolean;
  createdAt: string;
};

export type CommunicationCampaign = {
  id: string;
  name: string;
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  audienceType: string;
  audienceFilter: Record<string, unknown>;
  channels: string[];
  status: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
  template?: { id: string; name: string; code: string } | null;
  _count?: { recipients: number; deliveryLogs: number };
};

export type CommunicationDashboard = {
  templates: number;
  campaigns: number;
  sent: number;
  pending: number;
  deliveryStats: { channel: string; status: string; _count: number }[];
  recentCampaigns: Pick<
    CommunicationCampaign,
    'id' | 'name' | 'status' | 'sentAt' | 'createdAt' | 'audienceType'
  >[];
};

export type ResolvedRecipient = {
  recipientType: string;
  userId?: string;
  studentId?: string;
  staffProfileId?: string;
  displayName: string;
  email?: string;
  phone?: string;
};

export type CommunicationRecipient = {
  id: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  recipientType: string;
  deliveryStatus: string;
  readAt?: string | null;
  sentAt?: string | null;
};

export type DeliveryLog = {
  id: string;
  channel: string;
  status: string;
  provider?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  recipient?: { displayName?: string | null; email?: string | null };
  campaign?: { name: string; subject: string };
};

export type UserNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};
