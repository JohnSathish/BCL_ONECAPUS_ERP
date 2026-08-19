/**
 * Client-safe media URL helpers (no server-only).
 * Use for CMS paths like /uploads/... that need a browser-reachable origin.
 *
 * Never use API_INTERNAL_ORIGIN (e.g. http://api:3001) in HTML — that hostname
 * only exists on the Docker network and breaks public pages.
 */

const mediaOrigin = () => {
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (publicApi && /^https?:\/\//i.test(publicApi)) {
    return publicApi.endsWith('/api') ? publicApi.slice(0, -4) : publicApi;
  }

  // Relative API prefix (/api): keep media same-origin so nginx /uploads works
  // on both donboscocollege.ac.in and erp.donboscocollege.ac.in.
  if (publicApi === '/api' || (publicApi?.startsWith('/') && !publicApi.startsWith('//'))) {
    return '';
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (site && /^https?:\/\//i.test(site)) return site;

  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:3001';
  return '';
};

export function absoluteMediaUrl(src: string): string {
  if (!src) return src;
  if (src.startsWith('/images/')) return src;
  // Rewrite accidental Docker-internal / localhost URLs baked into cached HTML
  if (/^https?:\/\/(api|localhost|127\.0\.0\.1)(?::\d+)?\//i.test(src)) {
    const path = src.replace(/^https?:\/\/[^/]+/i, '');
    const origin = mediaOrigin();
    return origin ? `${origin}${path}` : path;
  }
  if (/^https?:\/\//i.test(src)) return src;
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
