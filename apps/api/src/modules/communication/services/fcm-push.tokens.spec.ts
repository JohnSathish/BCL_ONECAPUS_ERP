import { isApnsDeviceToken } from './fcm-push.service';

describe('isApnsDeviceToken', () => {
  it('recognises the 64-character Apple device token Expo returns on iOS', () => {
    expect(isApnsDeviceToken('ab'.repeat(32))).toBe(true);
    expect(isApnsDeviceToken('AB'.repeat(32))).toBe(true);
  });

  it('leaves an Android Firebase registration token on the existing FCM path', () => {
    expect(
      isApnsDeviceToken(
        'dK3xY:APA91bHexampletokenvalue-that-is-not-a-hex-apns-device-token',
      ),
    ).toBe(false);
  });

  it('does not treat an Expo push token as an Apple device token', () => {
    expect(isApnsDeviceToken('ExponentPushToken[abc123]')).toBe(false);
  });
});
