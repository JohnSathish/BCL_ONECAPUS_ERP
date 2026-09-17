/** Public auth screens must not attach JWTs or restore sessions. */
export function isAuthColdPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname.endsWith('/login') ||
    pathname.endsWith('/register')
  );
}

export function isBrowserAuthColdPath(): boolean {
  if (typeof window === 'undefined') return false;
  return isAuthColdPath(window.location.pathname);
}

/** Admin branding/theme APIs 403 for school students; skip on password setup too. */
export function skipTenantBrandingFetch(pathname: string | null | undefined) {
  if (isAuthColdPath(pathname)) return true;
  if (!pathname) return false;
  return (
    pathname === '/change-password' ||
    pathname.startsWith('/school-sis-portal') ||
    pathname.startsWith('/forgot-password')
  );
}
