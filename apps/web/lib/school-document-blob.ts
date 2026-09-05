/** Normalize authenticated school document downloads for reliable preview. */

function messageFromJsonPayload(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const json = value as { message?: unknown; error?: unknown; detail?: unknown };
  if (Array.isArray(json.message)) return json.message.map(String).join(', ');
  if (typeof json.message === 'string' && json.message.trim()) return json.message;
  if (typeof json.error === 'string' && json.error.trim()) return json.error;
  if (typeof json.detail === 'string' && json.detail.trim()) return json.detail;
  return null;
}

async function sniffMime(blob: Blob): Promise<string | null> {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (
    head.length >= 4 &&
    head[0] === 0x25 &&
    head[1] === 0x50 &&
    head[2] === 0x44 &&
    head[3] === 0x46
  ) {
    return 'application/pdf';
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

async function rejectIfJsonErrorBlob(blob: Blob): Promise<void> {
  const type = (blob.type || '').toLowerCase();
  const looksJson = type.includes('json') || type.includes('text');
  const tiny = blob.size > 0 && blob.size < 2048;
  if (!looksJson && !tiny) return;

  if (!looksJson) {
    const sniffed = await sniffMime(blob);
    if (sniffed) return;
    const head = new Uint8Array(await blob.slice(0, 1).arrayBuffer());
    if (head[0] !== 0x7b /* { */) return;
  }

  const text = await blob.text();
  try {
    const message = messageFromJsonPayload(JSON.parse(text));
    throw new Error(message || 'Document download failed');
  } catch (err) {
    if (err instanceof Error && err.message !== 'Document download failed') {
      // Re-throw intentional API errors; ignore JSON parse failures for binary.
      if (!(err instanceof SyntaxError)) throw err;
    }
    if (looksJson) {
      throw new Error(text.slice(0, 200) || 'Document download failed');
    }
  }
}

export async function normalizeSchoolDocumentBlob(
  blob: Blob,
  contentTypeHeader?: string | null,
): Promise<Blob> {
  await rejectIfJsonErrorBlob(blob);

  const headerType = String(contentTypeHeader ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  const sniffed = await sniffMime(blob);
  const nextType =
    sniffed ||
    (headerType && headerType !== 'application/octet-stream' && !headerType.includes('json')
      ? headerType
      : null) ||
    (blob.type && blob.type !== 'application/octet-stream' ? blob.type : null) ||
    'application/octet-stream';

  if (blob.type === nextType) return blob;
  return new Blob([await blob.arrayBuffer()], { type: nextType });
}

export function schoolDocumentPreviewKind(blob: Blob): 'image' | 'pdf' | 'other' {
  const type = (blob.type || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || type.includes('pdf')) return 'pdf';
  return 'other';
}
