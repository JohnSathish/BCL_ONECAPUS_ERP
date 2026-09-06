import { randomInt } from 'crypto';

export const SCHOOL_LOGIN_PIN_LENGTH = 6;
export const SCHOOL_LOGIN_PIN_PATTERN = /^\d{6}$/;
export const SCHOOL_LOGIN_PIN_MESSAGE =
  'Enter a 6-digit PIN using numbers 0–9 only';

export function isSchoolLoginPin(value: string | undefined): boolean {
  return Boolean(value && SCHOOL_LOGIN_PIN_PATTERN.test(value.trim()));
}

export function normalizeSchoolLoginPin(value: string): string {
  return value.replace(/\D/g, '').slice(0, SCHOOL_LOGIN_PIN_LENGTH);
}

export function generateSchoolLoginPin(): string {
  return String(randomInt(100000, 999999));
}

export function normalizeSchoolApplicationNumber(value: string): string {
  return value
    .trim()
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase();
}
