export function hostnameFromHeaderValue(host?: string | null) {
  const first = (host ?? '').split(',')[0]?.trim() ?? '';
  return first.split(':')[0]?.toLowerCase() ?? '';
}

export function isSchoolWebPublicHost(host?: string | null) {
  const name = hostnameFromHeaderValue(host);
  return name === 'school.localhost' || name === 'stlukestura.in' || name === 'www.stlukestura.in';
}

export function schoolHostFromRequestHeaders(h: { get(name: string): string | null }) {
  return hostnameFromHeaderValue(
    h.get('x-forwarded-host') || h.get('x-login-host') || h.get('host'),
  );
}
