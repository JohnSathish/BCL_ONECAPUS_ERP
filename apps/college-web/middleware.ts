import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const KIOSK_PATH = '/digital-notice-board';

function isNoticeboardHost(host: string) {
  const name = host.split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? '';
  return name === 'noticeboard.donboscocollege.ac.in' || name.startsWith('noticeboard.');
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const marked = request.headers.get('x-noticeboard') === '1';
  if (!marked && !isNoticeboardHost(host)) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (
    path === KIOSK_PATH ||
    path.startsWith('/api') ||
    path.startsWith('/uploads') ||
    path.startsWith('/_next') ||
    path.startsWith('/images')
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = KIOSK_PATH;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|uploads/).*)'],
};
