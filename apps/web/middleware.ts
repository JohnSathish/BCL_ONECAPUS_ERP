import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isLibraryHost(host: string) {
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  return hostname.startsWith('library.');
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (!isLibraryHost(host)) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/library-desk')) {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/library-desk/login';
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/staff') ||
    pathname.startsWith('/shift')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/library-desk';
    return NextResponse.redirect(url);
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? '/library-desk' : `/library-desk${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
