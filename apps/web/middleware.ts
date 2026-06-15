import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function hostname(host: string) {
  return host.split(':')[0]?.toLowerCase() ?? '';
}

function isLibraryHost(host: string) {
  return hostname(host).startsWith('library.');
}

function isAdmissionsHost(host: string) {
  return hostname(host).startsWith('admissions.');
}

function handleSubdomainRewrite(
  request: NextRequest,
  basePath: string,
  loginPath: string,
  blockedPrefixes: string[],
) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith(basePath)) {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  for (const prefix of blockedPrefixes) {
    if (pathname.startsWith(prefix)) {
      const url = request.nextUrl.clone();
      url.pathname = basePath;
      return NextResponse.redirect(url);
    }
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? basePath : `${basePath}${pathname}`;
  return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  if (isAdmissionsHost(host)) {
    return handleSubdomainRewrite(request, '/admissions-portal', '/admissions-portal/login', [
      '/admin',
      '/student',
      '/staff',
      '/shift',
      '/library-desk',
    ]);
  }

  if (isLibraryHost(host)) {
    return handleSubdomainRewrite(request, '/library-desk', '/library-desk/login', [
      '/admin',
      '/student',
      '/staff',
      '/shift',
    ]);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
