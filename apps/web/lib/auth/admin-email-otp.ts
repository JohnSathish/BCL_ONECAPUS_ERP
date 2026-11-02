export const ADMIN_EMAIL_OTP_STORAGE_KEY = 'bosco.adminEmailOtp';

export type StoredAdminEmailOtp = {
  challengeId: string;
  maskedEmail: string;
  expiresAt: string;
  resendAvailableAt: string;
  rememberMe: boolean;
  returnPath?: string;
};

export function readStoredAdminEmailOtp(): StoredAdminEmailOtp | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(ADMIN_EMAIL_OTP_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredAdminEmailOtp;
    if (!parsed.challengeId || !parsed.maskedEmail || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredAdminEmailOtp(value: StoredAdminEmailOtp) {
  sessionStorage.setItem(ADMIN_EMAIL_OTP_STORAGE_KEY, JSON.stringify(value));
}

export function clearStoredAdminEmailOtp() {
  sessionStorage.removeItem(ADMIN_EMAIL_OTP_STORAGE_KEY);
}
