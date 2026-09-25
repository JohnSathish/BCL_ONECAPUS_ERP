export type ClassifiedPushFailure = {
  key: string;
  label: string;
  retryable: boolean;
};

const RULES: Array<{
  test: RegExp;
  key: string;
  label: string;
  retryable: boolean;
}> = [
  {
    test: /UNREGISTERED|NOT.REGISTERED|REGISTRATION-TOKEN-NOT-REGISTERED|NOT_FOUND/i,
    key: 'EXPIRED',
    label: 'Device registration is no longer valid',
    retryable: false,
  },
  {
    test: /INVALID.ARGUMENT|INVALID-REGISTRATION|INVALID_TOKEN|SENDER_ID_MISMATCH|MISMATCHED-CREDENTIAL/i,
    key: 'INVALID',
    label: 'Invalid destination',
    retryable: false,
  },
  {
    test: /PERMISSION|NOT.AUTHORIZED|UNAUTHENTICATED/i,
    key: 'PERMISSION',
    label: 'App notification permission disabled',
    retryable: false,
  },
  // FCM cannot reach APNs when the Firebase iOS app has no APNs auth key/cert.
  {
    test: /THIRD.PARTY.AUTH|APNS.AUTH|APNS_AUTH|AUTH-ERROR.*APNS|APNS.*AUTH/i,
    key: 'APNS_CONFIG',
    label: 'Apple Push (APNs) not configured in Firebase',
    retryable: false,
  },
  {
    test: /UNAVAILABLE|INTERNAL|UNKNOWN|QUOTA|RESOURCE-EXHAUSTED|TIMEOUT|UNAVAILABLE/i,
    key: 'TEMPORARY',
    label: 'Temporary delivery failure',
    retryable: true,
  },
  {
    test: /THIRD.PARTY|FIREBASE|FCM|SERVER/i,
    key: 'PROVIDER',
    label: 'Firebase service error',
    retryable: true,
  },
];

export function classifyPushFailure(
  code?: string | null,
  reason?: string | null,
): ClassifiedPushFailure {
  const hay = `${code ?? ''} ${reason ?? ''}`;
  for (const rule of RULES) {
    if (rule.test.test(hay)) {
      return { key: rule.key, label: rule.label, retryable: rule.retryable };
    }
  }
  if (!code && !reason) {
    return {
      key: 'UNKNOWN',
      label: 'Unknown delivery error',
      retryable: false,
    };
  }
  return {
    key: 'UNKNOWN',
    label: 'Unknown delivery error',
    retryable: false,
  };
}

export const PERMANENT_FAILURE_CODES = [
  'UNREGISTERED',
  'INVALID_ARGUMENT',
  'NOT_FOUND',
  'SENDER_ID_MISMATCH',
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
  'messaging/mismatched-credential',
];
