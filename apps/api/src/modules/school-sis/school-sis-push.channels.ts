import type { NotificationProvider } from './school-sis-push.provider';

/** Future SMS / WhatsApp / email adapters plug in here. Push is FCM today. */
export class SmsNotificationProvider implements NotificationProvider {
  async send(_input: Parameters<NotificationProvider['send']>[0]) {
    return {
      ok: false,
      provider: 'sms',
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
      perToken: [],
    };
  }
}

export class WhatsAppNotificationProvider implements NotificationProvider {
  async send(_input: Parameters<NotificationProvider['send']>[0]) {
    return {
      ok: false,
      provider: 'whatsapp',
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
      perToken: [],
    };
  }
}

export class EmailNotificationProvider implements NotificationProvider {
  async send(_input: Parameters<NotificationProvider['send']>[0]) {
    return {
      ok: false,
      provider: 'email',
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
      perToken: [],
    };
  }
}
