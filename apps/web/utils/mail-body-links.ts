export type LinkedMailFile = {
  label: string;
  url: string;
};

const DOC_EXT = 'pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|webp|zip|rar|txt|csv';

/** Extract Drive / cloud file links pasted as plain text in mail bodies. */
export function extractLinkedFilesFromMailBody(raw: string | null | undefined): LinkedMailFile[] {
  if (!raw?.trim()) return [];
  const text = raw;
  const out: LinkedMailFile[] = [];
  const seen = new Set<string>();

  const push = (label: string, url: string) => {
    const cleanUrl = url.replace(/[),.;]+$/, '').replace(/&amp;/g, '&');
    if (!/^https?:\/\//i.test(cleanUrl) || seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    out.push({
      label: (label || guessLabelFromUrl(cleanUrl)).replace(/<[^>]+>/g, '').trim() || 'Open file',
      url: cleanUrl,
    });
  };

  const htmlA = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = htmlA.exec(text))) {
    push(m[2]!, m[1]!);
  }

  const nameAngle = new RegExp(
    `([^\\s<>\\[\\]]+\\.(?:${DOC_EXT}))\\s*<\\s*(https?:\\/\\/[^>\\s]+)\\s*>`,
    'gi',
  );
  while ((m = nameAngle.exec(text))) {
    push(m[1]!, m[2]!);
  }

  const mdLink = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
  while ((m = mdLink.exec(text))) {
    push(m[1]!, m[2]!);
  }

  const bareDrive = /https?:\/\/(?:drive|docs)\.google\.com\/[^\s<>"']+/gi;
  while ((m = bareDrive.exec(text))) {
    push(guessLabelFromUrl(m[0]!), m[0]!);
  }

  return out;
}

export function stripLinkedFileMarkup(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(
      new RegExp(`[^\\s<>\\[\\]]+\\.(?:${DOC_EXT})\\s*<\\s*https?:\\/\\/[^>\\s]+\\s*>`, 'gi'),
      '',
    )
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function guessLabelFromUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('drive.google.com')) return 'Google Drive file';
    if (u.hostname.includes('docs.google.com')) return 'Google Doc';
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : 'Open link';
  } catch {
    return 'Open link';
  }
}
