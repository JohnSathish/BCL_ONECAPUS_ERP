/** Raw APNs device tokens are hex; FCM registration tokens are not. */
export function isApnsDeviceToken(token: string): boolean {
  const t = token.trim();
  if (!t || t.includes(':') || /APA91/i.test(t)) return false;
  if (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))
    return false;
  return /^[0-9a-fA-F]{64,200}$/.test(t);
}
