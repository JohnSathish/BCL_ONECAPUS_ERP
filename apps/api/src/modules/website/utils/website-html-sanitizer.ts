import * as cheerio from 'cheerio';

const ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const GLOBAL_ATTRIBUTES = new Set(['class', 'id', 'title']);
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
};

function isSafeUrl(value: string, tag: string, attribute: string): boolean {
  const normalized = Array.from(value.trim())
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127 && !/\s/.test(character);
    })
    .join('');
  if (!normalized) return false;
  if (
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    normalized.startsWith('../') ||
    normalized.startsWith('#')
  ) {
    return true;
  }
  const lower = normalized.toLowerCase();
  if (lower.startsWith('https://') || lower.startsWith('http://')) return true;
  return (
    tag === 'a' &&
    attribute === 'href' &&
    (lower.startsWith('mailto:') || lower.startsWith('tel:'))
  );
}

/**
 * Sanitizes CMS rich text server-side. Scripts, embedded content, event
 * handlers, inline styles, unsafe protocols and SVG markup are discarded.
 */
export function sanitizeWebsiteHtml(input?: string | null): string {
  if (!input) return '';
  const $ = cheerio.load(`<div id="cms-sanitize-root">${input}</div>`, {
    xmlMode: false,
  });
  const root = $('#cms-sanitize-root');

  root
    .find(
      'script,style,iframe,object,embed,form,input,button,textarea,select,link,meta,base,svg,math',
    )
    .remove();

  root.find('*').each((_index, element) => {
    const node = $(element);
    const tag = element.tagName?.toLowerCase();
    if (!tag || !ALLOWED_TAGS.has(tag)) {
      node.replaceWith(node.contents());
      return;
    }

    const attributes = node.attr() ?? {};
    for (const name of Object.keys(attributes)) {
      const lowerName = name.toLowerCase();
      const allowed =
        GLOBAL_ATTRIBUTES.has(lowerName) || TAG_ATTRIBUTES[tag]?.has(lowerName);
      if (!allowed || lowerName.startsWith('on') || lowerName === 'style') {
        node.removeAttr(name);
        continue;
      }
      if (
        (lowerName === 'href' || lowerName === 'src') &&
        !isSafeUrl(attributes[name] ?? '', tag, lowerName)
      ) {
        node.removeAttr(name);
      }
    }

    if (tag === 'a' && node.attr('target') === '_blank') {
      node.attr('rel', 'noopener noreferrer');
    }
    if (tag === 'img') node.attr('loading', 'lazy');
  });

  return root.html()?.trim() ?? '';
}
