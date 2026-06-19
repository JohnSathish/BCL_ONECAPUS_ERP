/** Production college hosts — never show dev demo login helpers. */
const PRODUCTION_HOST_MARKERS = ['donboscocollege.ac.in'] as const;

export function isProductionCollegeHost(hostname?: string): boolean {
  const host = (
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  ).toLowerCase();
  if (!host) return false;
  return PRODUCTION_HOST_MARKERS.some((marker) => host === marker || host.endsWith(`.${marker}`));
}

/** True only on local/demo sites — never on live college domain. */
export function isDemoLoginWorkspaceEnabled(): boolean {
  if (isProductionCollegeHost()) return false;
  return process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === 'true';
}
