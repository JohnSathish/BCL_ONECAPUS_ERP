import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdmissionsLoginPath, isAdmissionsPublicPath } from '@/lib/admissions-portal-routes';
import {
  isSchoolAdmissionHostName,
  isSchoolAdmissionsLoginPath,
  isSchoolAdmissionsPublicPath,
} from '@/lib/school-admissions-portal-routes';
import { isProductionCollegeHost } from '@/lib/demo-login';
import { extractJournalSlugFromHost, isJournalHost } from '@/lib/journals-host';

function hostname(host: string) {
  return host.split(':')[0]?.toLowerCase() ?? '';
}

function isLibraryHost(host: string) {
  return hostname(host).startsWith('library.');
}

function isAdmissionsHost(host: string) {
  return hostname(host).startsWith('admissions.');
}

function isSchoolAdmissionHost(host: string) {
  return isSchoolAdmissionHostName(host);
}

function isCareerHost(host: string) {
  return hostname(host).startsWith('career.');
}

function isAlumniHost(host: string) {
  return hostname(host).startsWith('alumni.');
}

function isPayHost(host: string) {
  return hostname(host).startsWith('pay.');
}

function handleCareerHost(request: NextRequest) {
  return handleSubdomainRewrite(request, '/careers-portal', '/careers-portal', [
    '/admin',
    '/student',
    '/staff',
    '/shift',
    '/library-desk',
    '/admissions-portal',
    '/alumni-portal',
    '/journals-portal',
  ]);
}

function handleAlumniHost(request: NextRequest) {
  return handleSubdomainRewrite(request, '/alumni-portal', '/alumni-portal/register', [
    '/admin',
    '/student',
    '/staff',
    '/shift',
    '/library-desk',
    '/admissions-portal',
    '/careers-portal',
    '/journals-portal',
  ]);
}

async function handleJournalHost(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const slug = extractJournalSlugFromHost(host);
  const { pathname } = request.nextUrl;

  if (pathname === '/sitemap.xml' || pathname === '/robots.txt') {
    const url = request.nextUrl.clone();
    url.pathname = `/journals-portal${pathname}`;
    const response = NextResponse.rewrite(url);
    if (slug) response.headers.set('x-journal-slug', slug);
    return response;
  }

  // Legacy Google Sites / CMS redirects (host-aware)
  if (
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/uploads') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/journals-portal') &&
    pathname !== '/'
  ) {
    const redirected = await resolveJournalRedirect(request, pathname, slug);
    if (redirected) return redirected;
  }

  const response = handleSubdomainRewrite(request, '/journals-portal', '/journals-portal', [
    '/admin',
    '/student',
    '/staff',
    '/shift',
    '/library-desk',
    '/admissions-portal',
    '/careers-portal',
    '/alumni-portal',
  ]);
  if (slug && response instanceof NextResponse) {
    response.headers.set('x-journal-slug', slug);
  }
  return response;
}

/** Built-in fallbacks + API JournalRedirect lookup for CMS-managed paths. */
async function resolveJournalRedirect(request: NextRequest, pathname: string, slug: string | null) {
  const STATIC: Record<string, string> = {
    '/about-the-journal': '/journals-portal/about',
    '/published-volumes': '/journals-portal/archives',
    '/advisory-board': '/journals-portal/advisory-board',
    '/downloads': '/journals-portal/downloads',
  };
  const staticTarget = STATIC[pathname.replace(/\/+$/, '') || '/'];
  if (staticTarget) {
    const url = request.nextUrl.clone();
    url.pathname = staticTarget;
    return NextResponse.redirect(url, 301);
  }

  try {
    const apiBase =
      process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';
    const base = apiBase.startsWith('http')
      ? apiBase.replace(/\/$/, '')
      : `${request.nextUrl.origin}${apiBase.replace(/\/$/, '')}`;
    const qs = new URLSearchParams({ path: pathname });
    if (slug) qs.set('journal', slug);
    const res = await fetch(`${base}/v1/journals/portal/redirect-lookup?${qs}`, {
      headers: {
        ...(slug ? { 'x-journal-slug': slug } : {}),
        'x-login-host': request.headers.get('host') ?? '',
      },
      // Edge-friendly short timeout via AbortSignal if available
      signal: AbortSignal.timeout?.(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      toPath?: string;
      statusCode?: number;
      data?: { toPath?: string; statusCode?: number };
    };
    // API wraps payloads as { success, data }
    const toPath = data.data?.toPath ?? data.toPath;
    const statusCode = data.data?.statusCode ?? data.statusCode ?? 301;
    if (!toPath) return null;
    const url = request.nextUrl.clone();
    url.pathname = toPath.startsWith('/') ? toPath : `/${toPath}`;
    return NextResponse.redirect(url, statusCode as 301 | 302);
  } catch {
    return null;
  }
}

function handleSchoolAdmissionHost(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loginPath = '/school-admissions-portal/login';
  const portalPath = '/school-admissions-portal';

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

  if (pathname === '/' || pathname === '/school-admissions-portal') {
    const url = request.nextUrl.clone();
    url.pathname = hasRefreshCookie
      ? '/school-admissions-portal/dashboard'
      : '/school-admissions-portal/register';
    return NextResponse.redirect(url);
  }

  const isPublic = isSchoolAdmissionsPublicPath(pathname);
  const isLogin = isSchoolAdmissionsLoginPath(pathname) || pathname === '/login';

  if (!hasRefreshCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    return NextResponse.redirect(url);
  }

  if (hasRefreshCookie && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/school-admissions-portal/dashboard';
    return NextResponse.redirect(url);
  }

  return handleSubdomainRewrite(request, portalPath, loginPath, [
    '/admin',
    '/student',
    '/staff',
    '/shift',
    '/library-desk',
    '/journals-portal',
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
    '/journals-portal',
    '/school-admissions-portal',
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
    '/journals-portal',
  ]);
}

function handlePayHost(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const portalPath = '/public-fee-pay';

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Legacy café / ERP entry points → public pay home
  if (
    pathname.startsWith('/fee-collection-portal') ||
    pathname.startsWith('/centers') ||
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/register' ||
    pathname.startsWith('/register/')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = portalPath;
    return NextResponse.redirect(url);
  }

  // QR / legacy verify path
  if (pathname.startsWith('/verify/receipt/')) {
    const receiptNo = pathname.replace('/verify/receipt/', '');
    const url = request.nextUrl.clone();
    url.pathname = `${portalPath}/verify`;
    url.searchParams.set('receiptNo', receiptNo);
    return NextResponse.redirect(url);
  }

  if (pathname === '/verify' || pathname.startsWith('/verify/')) {
    const url = request.nextUrl.clone();
    url.pathname = `${portalPath}/verify`;
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith(portalPath)) {
    return NextResponse.next();
  }

  const blocked = [
    '/admin',
    '/student',
    '/staff',
    '/parent',
    '/shift',
    '/library-desk',
    '/admissions-portal',
    '/careers-portal',
    '/alumni-portal',
    '/journals-portal',
    '/principal-desk',
  ];
  for (const prefix of blocked) {
    if (pathname.startsWith(prefix)) {
      const url = request.nextUrl.clone();
      url.pathname = portalPath;
      return NextResponse.redirect(url);
    }
  }

  const url = request.nextUrl.clone();
  if (pathname === '/' || pathname === '') {
    url.pathname = portalPath;
    return NextResponse.rewrite(url);
  }
  if (pathname === '/return' || pathname.startsWith('/return/')) {
    url.pathname = pathname.replace(/^\/return/, `${portalPath}/return`);
    return NextResponse.rewrite(url);
  }

  url.pathname = `${portalPath}${pathname}`;
  return NextResponse.rewrite(url);
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

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  if (isSchoolAdmissionHost(host)) {
    return handleSchoolAdmissionHost(request);
  }

  if (isAdmissionsHost(host)) {
    return handleAdmissionsHost(request);
  }

  if (isCareerHost(host)) {
    return handleCareerHost(request);
  }

  if (isAlumniHost(host)) {
    return handleAlumniHost(request);
  }

  if (isLibraryHost(host)) {
    return handleLibraryHost(request);
  }

  if (isPayHost(host)) {
    return handlePayHost(request);
  }

  if (isJournalHost(host)) {
    return handleJournalHost(request);
  }

  // College ERP host: skip BCL marketing landing — staff expect login first.
  const { pathname } = request.nextUrl;
  if (pathname === '/' && isProductionCollegeHost(hostname(host))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
