/**
 * Sanitize HTML before rendering with dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DOMPurify = require('isomorphic-dompurify') as {
      sanitize: (dirty: string, cfg?: Record<string, unknown>) => string;
    };
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true, svg: true },
    });
  } catch {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }
}
