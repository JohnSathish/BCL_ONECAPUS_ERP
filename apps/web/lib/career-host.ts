export function getCareerHostHeader(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_CAREER_HOST ?? 'career.demo.localhost';
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_CAREER_HOST ?? 'career.demo.localhost';
  }
  return window.location.host.includes(':')
    ? window.location.host.split(':')[0]!
    : window.location.hostname;
}

export function getCareerRequestHeaders(): Record<string, string> {
  const host = getCareerHostHeader();
  return {
    'X-Forwarded-Host': host,
    'X-Login-Host': host,
  };
}
