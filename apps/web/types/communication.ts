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
  approvalStatus?: string;
  requiresApproval?: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
  template?: { id: string; name: string; code: string } | null;
  _count?: { recipients: number; deliveryLogs: number };
};

export type CommunicationQueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

export type CommunicationChannelHealth = {
  email: {
    connected: boolean;
    provider: string;
    lastSent?: string | null;
    queueSize: number;
  };
  sms: {
    connected: boolean;
    provider: string;
    balance: number | null;
    usedToday: number;
    usedThisMonth: number;
  };
  whatsapp: {
    connected: boolean;
    templatesApproved: number;
    messagesDelivered: number;
  };
  push: {
    connected: boolean;
    demoMode?: boolean;
    activeDevices: number;
    deliveryRate: number | null;
  };
};

export type CommunicationLiveActivity = {
  id: string;
  time: string;
  channel: string;
  status: string;
  label: string;
};

export type CommunicationDashboard = {
  templates: number;
  campaigns: number;
  sent: number;
  pending: number;
  scheduledCount: number;
  activeCampaigns: number;
  messagesSentToday: number;
  messagesSentThisMonth: number;
  deliverySuccessRate: number;
  failedCount: number;
  openRate: number | null;
  clickRate: number | null;
  deliveryStats: { channel: string; status: string; _count: number }[];
  recentCampaigns: Pick<
    CommunicationCampaign,
    'id' | 'name' | 'status' | 'sentAt' | 'createdAt' | 'audienceType'
  >[];
  liveActivity: CommunicationLiveActivity[];
  queueStats: CommunicationQueueStats;
  channelHealth: CommunicationChannelHealth;
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
  dismissedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
};

export type CommunicationApproval = {
  id: string;
  campaignId: string;
  status: string;
  currentApproverRole?: string | null;
  createdAt: string;
};

export type CommunicationAutomationRule = {
  id: string;
  code: string;
  name: string;
  category: string;
  isEnabled: boolean;
  schedule?: string | null;
  channels: string[];
  templateCode?: string | null;
};

export type CommunicationSettings = {
  defaultSenderName?: string | null;
  replyEmail?: string | null;
  smsSenderId?: string | null;
  whatsappBusinessNumber?: string | null;
  notificationLogoUrl?: string | null;
  footerTemplate?: string | null;
  smtpConfig?: Record<string, unknown>;
  smsConfig?: Record<string, unknown>;
  whatsappConfig?: Record<string, unknown>;
};

export type CommunicationAnalytics = {
  byChannel: Record<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
      opened: number;
      read: number;
      clicked: number;
    }
  >;
  daily: { day: string; channel: string; count: number }[];
};
