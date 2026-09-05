import axios from 'axios';
import { ApiError } from '@/lib/http/api-error-types';

const EMAIL_EXISTS_CODES = new Set(['SCHOOL_APPLICATION_EMAIL_EXISTS']);
const PHONE_EXISTS_CODES = new Set(['SCHOOL_APPLICATION_PHONE_EXISTS']);

function responseErrorCode(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const code = (error.response?.data as { errorCode?: string } | undefined)?.errorCode;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

function responseMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message || '';
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; detail?: string } | undefined;
    return String(data?.detail || data?.message || error.message || '');
  }
  if (error instanceof Error) return error.message;
  return '';
}

function looksLikeExistingApplicationMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('application is already registered') ||
    lower.includes('application already exists') ||
    (lower.includes('already exists') &&
      (lower.includes('email') || lower.includes('mobile') || lower.includes('phone')))
  );
}

/** True when register/OTP is blocked because this email already has an application. */
export function isSchoolExistingEmailApplicationError(error: unknown): boolean {
  const code = responseErrorCode(error);
  if (code && EMAIL_EXISTS_CODES.has(code)) return true;
  if (code && PHONE_EXISTS_CODES.has(code)) return false;

  if (axios.isAxiosError(error) && error.response?.status === 409) {
    const message = responseMessage(error).toLowerCase();
    if (message.includes('mobile') || message.includes('phone')) {
      // Phone-only conflicts are not email conflicts.
      return message.includes('email');
    }
    return looksLikeExistingApplicationMessage(responseMessage(error));
  }

  return looksLikeExistingApplicationMessage(responseMessage(error));
}

export function isSchoolExistingApplicationError(error: unknown): boolean {
  const code = responseErrorCode(error);
  if (code && (EMAIL_EXISTS_CODES.has(code) || PHONE_EXISTS_CODES.has(code))) {
    return true;
  }
  if (axios.isAxiosError(error) && error.response?.status === 409) {
    return looksLikeExistingApplicationMessage(responseMessage(error));
  }
  return looksLikeExistingApplicationMessage(responseMessage(error));
}
