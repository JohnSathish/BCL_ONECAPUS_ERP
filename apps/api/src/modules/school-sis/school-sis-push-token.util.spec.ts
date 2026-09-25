import { isApnsDeviceToken } from './school-sis-push-token.util';

describe('isApnsDeviceToken', () => {
  it('detects hex APNs tokens', () => {
    expect(isApnsDeviceToken('a'.repeat(64))).toBe(true);
  });

  it('rejects FCM registration tokens', () => {
    expect(
      isApnsDeviceToken('dXyz:APA91bExampleFcmRegistrationTokenNotApns'),
    ).toBe(false);
  });

  it('rejects Expo tokens', () => {
    expect(isApnsDeviceToken('ExponentPushToken[abc]')).toBe(false);
  });
});
