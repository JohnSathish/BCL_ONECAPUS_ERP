/** Validate and surface errors for ID-card PDF blobs (axios often lies about MIME). */

export async function blobIsPdf(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  // %PDF-
  return (
    head.length >= 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
  );
}

export async function readBlobErrorMessage(blob: Blob): Promise<string> {
  try {
    const text = await blob.text();
    try {
      const json = JSON.parse(text) as { message?: string | string[]; error?: string };
      if (Array.isArray(json.message)) return json.message.join(', ');
      if (typeof json.message === 'string') return json.message;
      if (typeof json.error === 'string') return json.error;
    } catch {
      /* not JSON */
    }
    return text.slice(0, 500) || 'PDF render failed';
  } catch {
    return 'PDF render failed';
  }
}

/** Ensure blob is a real PDF; throw with a readable message otherwise. */
export async function assertPdfBlob(blob: Blob): Promise<Blob> {
  if (!(await blobIsPdf(blob))) {
    throw new Error(await readBlobErrorMessage(blob));
  }
  return blob.type === 'application/pdf'
    ? blob
    : new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
}
