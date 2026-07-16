import { headers } from 'next/headers';

const API_BASE = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001/api';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const h = await headers();
  const host =
    h.get('x-forwarded-host') ||
    h.get('host') ||
    process.env.NEXT_PUBLIC_JOURNALS_HOST ||
    'transient.demo.localhost';
  const slug = h.get('x-journal-slug') || process.env.NEXT_PUBLIC_JOURNAL_SLUG || 'transient';

  const apiUrl = new URL(`${API_BASE}/v1/journals/portal/oai`);
  url.searchParams.forEach((v, k) => apiUrl.searchParams.set(k, v));

  const res = await fetch(apiUrl.toString(), {
    headers: {
      'X-Login-Host': host.split(':')[0]!,
      'X-Forwarded-Host': host.split(':')[0]!,
      'X-Journal-Slug': slug,
    },
    cache: 'no-store',
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'text/xml; charset=utf-8',
    },
  });
}
