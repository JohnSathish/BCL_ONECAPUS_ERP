/** Chrome blocks the unload permission on some pages and logs a console violation. */
export function canWarnBeforeLeave(): boolean {
  if (typeof document === 'undefined') return false;
  const policy = document.permissionsPolicy;
  if (!policy) return true;
  try {
    return policy.allowsFeature('unload');
  } catch {
    return true;
  }
}
