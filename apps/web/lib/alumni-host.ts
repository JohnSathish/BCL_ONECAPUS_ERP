/** Host helpers for the public Alumni Association portal. */

export function getAlumniHostHeader(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_ALUMNI_HOST ?? 'alumni.demo.localhost';
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_ALUMNI_HOST ?? 'alumni.demo.localhost';
  }
  return window.location.host.includes(':')
    ? window.location.host.split(':')[0]!
    : window.location.hostname;
}

export function getAlumniRequestHeaders(): Record<string, string> {
  const host = getAlumniHostHeader();
  return {
    'X-Forwarded-Host': host,
    'X-Login-Host': host,
  };
}

export const ALUMNI_PUBLIC_URL =
  process.env.NEXT_PUBLIC_ALUMNI_URL ?? 'https://alumni.donboscocollege.ac.in';
