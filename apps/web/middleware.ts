import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdmissionsLoginPath, isAdmissionsPublicPath } from '@/lib/admissions-portal-routes';

function hostname(host: string) {
  return host.split(':')[0]?.toLowerCase() ?? '';
}

function isLibraryHost(host: string) {
  return hostname(host).startsWith('library.');
}

function isAdmissionsHost(host: string) {
  return hostname(host).startsWith('admissions.');
}

function isCareerHost(host: string) {
  return hostname(host).startsWith('career.');
}

function handleCareerHost(request: NextRequest) {
  return handleSubdomainRewrite(request, '/careers-portal', '/careers-portal', [
    '/admin',
    '/student',
    '/staff',
    '/shift',
    '/library-desk',
    '/admissions-portal',
  ]);
}

function handleAdmissionsHost(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loginPath = '/admissions-portal/login';
  const portalPath = '/admissions-portal';

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const refreshCookie = request.cookies.get('nep_refresh')?.value;
  const hasRefreshCookie = Boolean(refreshCookie && refreshCookie.length >= 10);
  const effectivePath = pathname === '/' ? portalPath : pathname;
  const isPublic = isAdmissionsPublicPath(effectivePath);
  const isLogin = isAdmissionsLoginPath(effectivePath) || pathname === '/login';

  if (!hasRefreshCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  if (hasRefreshCookie && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admissions-portal/dashboard';
    return NextResponse.redirect(url);
  }

  return handleSubdomainRewrite(request, portalPath, loginPath, [
    '/admin',
    '/student',
    '/staff',
    '/shift',
    '/library-desk',
  ]);
}

function handleLibraryHost(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loginPath = '/library-desk/login';
  const deskPath = '/library-desk';

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const refreshCookie = request.cookies.get('nep_refresh')?.value;
  const hasRefreshCookie = Boolean(refreshCookie && refreshCookie.length >= 10);
  const isLogin =
    pathname === '/login' || pathname === loginPath || pathname.startsWith(`${loginPath}/`);

  if (!hasRefreshCookie && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  if (hasRefreshCookie && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = deskPath;
    return NextResponse.redirect(url);
  }

  return handleSubdomainRewrite(request, deskPath, loginPath, [
    '/admin',
    '/student',
    '/staff',
    '/shift',
  ]);
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
    return handleAdmissionsHost(request);
  }

  if (isCareerHost(host)) {
    return handleCareerHost(request);
  }

  if (isLibraryHost(host)) {
    return handleLibraryHost(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
