import { ProfileCompletionMonitorService } from './profile-completion-monitor.service';

describe('ProfileCompletionMonitorService push inbox', () => {
  const prisma = {
    mobileDevice: { findMany: jest.fn() },
    userNotification: { delete: jest.fn() },
  };
  const whatsapp = { isConfigured: jest.fn(), send: jest.fn() };
  const sms = { isConfigured: jest.fn(), send: jest.fn() };
  const fcm = { isConfigured: jest.fn(), sendToTokens: jest.fn() };
  const notifications = { createInApp: jest.fn() };

  const service = new ProfileCompletionMonitorService(
    prisma as never,
    whatsapp as never,
    sms as never,
    fcm as never,
    notifications as never,
  );

  const student = {
    studentId: 'student-1',
    userId: 'user-1',
    fullName: 'Aisha',
    mobileNumber: '9876543210',
    whatsappNumber: null,
  };
  const fullBody = `Please complete your profile. ${'Missing field. '.repeat(20)}`;

  function deliver(channel: 'PUSH' | 'SMS' = 'PUSH') {
    return (
      service as unknown as {
        deliver: (
          tenantId: string,
          row: typeof student,
          channel: 'PUSH' | 'SMS',
          body: string,
        ) => Promise<{ status: string; provider?: string }>;
      }
    ).deliver('tenant-1', student, channel, fullBody);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mobileDevice.findMany.mockResolvedValue([{ pushToken: 'token-1' }]);
    prisma.userNotification.delete.mockResolvedValue({ id: 'note-1' });
    fcm.isConfigured.mockReturnValue(true);
    notifications.createInApp.mockResolvedValue({ id: 'note-1' });
  });

  it('keeps a confirmed push in the notification menu after the tray copy is gone', async () => {
    fcm.sendToTokens.mockResolvedValue({
      ok: true,
      provider: 'fcm',
      providerRef: 'projects/x/messages/1',
      successCount: 1,
    });

    const result = await deliver();

    expect(result.status).toBe('SENT');
    expect(notifications.createInApp).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        type: 'PROFILE_COMPLETION',
        title: 'Complete Your Student Profile',
        body: fullBody,
        link: '/student/my-profile',
        metadata: expect.objectContaining({
          source: 'profile_completion_monitor',
          studentId: 'student-1',
          mobilePath: '/(student)/complete-profile',
        }),
      }),
    );
    expect(fcm.sendToTokens).toHaveBeenCalledWith(
      ['token-1'],
      expect.objectContaining({
        body: fullBody.slice(0, 180),
        data: expect.objectContaining({
          type: 'PROFILE_COMPLETION',
          notificationId: 'note-1',
          link: '/student/my-profile',
        }),
      }),
    );
    expect(prisma.userNotification.delete).not.toHaveBeenCalled();
  });

  it('does not leave a menu row when the device push is not confirmed', async () => {
    fcm.sendToTokens.mockResolvedValue({
      ok: false,
      provider: 'fcm',
      error: 'rejected',
      successCount: 0,
    });

    const result = await deliver();

    expect(result.status).toBe('FAILED');
    expect(prisma.userNotification.delete).toHaveBeenCalledWith({
      where: { id: 'note-1' },
    });
  });

  it('does not write a menu row for SMS reminders', async () => {
    sms.isConfigured.mockReturnValue(false);

    const result = await deliver('SMS');

    expect(result.status).toBe('FAILED');
    expect(notifications.createInApp).not.toHaveBeenCalled();
    expect(fcm.sendToTokens).not.toHaveBeenCalled();
  });
});
