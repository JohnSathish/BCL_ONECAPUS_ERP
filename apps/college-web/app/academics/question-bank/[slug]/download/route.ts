import { cmsHeaders, cmsUrl } from '@/lib/cms-client';

export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const notFound = () =>
  new Response('Question paper not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Same-origin PDF delivery; the API only serves papers that are currently Published. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug) || slug.length > 120) return notFound();

  const url = cmsUrl(`question-bank/papers/${slug}/file`);
  if (!url) return notFound();
  const download = new URL(request.url).searchParams.get('download');
  if (download === '1' || download === '0') url.searchParams.set('download', download);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: cmsHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return new Response('Question paper is temporarily unavailable', {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (!upstream.ok || !upstream.body) return notFound();

  const headers = new Headers({
    'content-type': 'application/pdf',
    'cache-control': 'public, max-age=300',
    'x-content-type-options': 'nosniff',
  });
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) headers.set('content-disposition', disposition);
  const length = upstream.headers.get('content-length');
  if (length) headers.set('content-length', length);

  return new Response(upstream.body, { status: 200, headers });
}
