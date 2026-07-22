/**
 * Client-safe media URL helpers (no server-only).
 * Use for CMS paths like /uploads/... that need the API origin in the browser.
 */

const mediaOrigin = () => {
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (publicApi?.endsWith('/api')) return publicApi.slice(0, -4);
  if (publicApi && /^https?:\/\//i.test(publicApi)) return publicApi;
  const internal = process.env.API_INTERNAL_ORIGIN?.replace(/\/+$/, '');
  if (internal && /^https?:\/\/[^/]+$/i.test(internal)) return internal;
  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:3001';
  return '';
};

export function absoluteMediaUrl(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src) || src.startsWith('/images/')) return src;
  if (src.startsWith('/')) {
    const origin = mediaOrigin();
    return origin ? `${origin}${src}` : src;
  }
  return src;
}

/** Resolve CMS media paths (e.g. /uploads/...) to absolute API URLs for the browser. */
export function absolutizeMediaUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  return absoluteMediaUrl(src);
}
