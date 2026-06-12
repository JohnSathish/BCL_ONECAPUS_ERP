export function getLoginHostHeader(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_LOGIN_HOST ?? 'demo.localhost';
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_LOGIN_HOST ?? 'demo.localhost';
  }
  return window.location.host.includes(':')
    ? window.location.host.split(':')[0]!
    : window.location.hostname;
}

/** Headers for login/context API calls so the backend resolves the institution tenant. */
export function getLoginRequestHeaders(): Record<string, string> {
  const host = getLoginHostHeader();
  return {
    'X-Forwarded-Host': host,
    'X-Login-Host': host,
  };
}
