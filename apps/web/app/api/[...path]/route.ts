import { NextRequest, NextResponse } from 'next/server';

const API_ORIGIN =
  process.env.API_INTERNAL_ORIGIN ??
  process.env.API_DEV_ORIGIN ??
  process.env.NEXT_PRIVATE_API_ORIGIN ??
  'http://127.0.0.1:3001';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

type RouteContext = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

async function proxyApiRequest(request: NextRequest, context: RouteContext) {
  const traceId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const params = await context.params;
  const path = (params.path ?? []).map(encodeURIComponent).join('/');
  const upstreamUrl = new URL(`/api/${path}`, API_ORIGIN);
  upstreamUrl.search = request.nextUrl.search;

  try {
    const headers = new Headers(request.headers);
    for (const header of HOP_BY_HOP_HEADERS) headers.delete(header);
    headers.set('accept', headers.get('accept') ?? 'application/json');
    headers.set('x-request-id', traceId);

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('x-request-id', traceId);
    responseHeaders.delete('content-length');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[api-proxy] upstream unavailable', {
      traceId,
      url: upstreamUrl.toString(),
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        errorCode: 'API_PROXY_UNAVAILABLE',
        message: 'Unable to reach the API server. Please confirm the backend is running.',
        details: { upstream: API_ORIGIN },
        timestamp: new Date().toISOString(),
        traceId,
      },
      {
        status: 502,
        headers: {
          'x-request-id': traceId,
          'cache-control': 'no-store',
        },
      },
    );
  }
}
