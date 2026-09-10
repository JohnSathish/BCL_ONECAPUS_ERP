export function isSchoolWebPublicHost(host?: string | null) {
  const name = (host ?? '').split(':')[0]?.toLowerCase() ?? '';
  return name === 'school.localhost' || name === 'stlukestura.in' || name === 'www.stlukestura.in';
}
