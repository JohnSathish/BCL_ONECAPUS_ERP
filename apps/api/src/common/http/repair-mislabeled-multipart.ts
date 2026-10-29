import { Logger } from '@nestjs/common';
import Busboy from 'busboy';
import type { NextFunction, Request, Response } from 'express';
import { Readable } from 'stream';

declare module 'busboy' {
  interface BusboyFileInfo {
    filename: string;
    encoding: string;
    mimeType: string;
  }
  interface BusboyParser {
    on(event: 'field', listener: (name: string, value: string) => void): this;
    on(
      event: 'file',
      listener: (name: string, stream: Readable, info: BusboyFileInfo) => void,
    ): this;
    on(event: 'finish', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
  }
  function Busboy(options: { headers: Record<string, string> }): BusboyParser;
  export default Busboy;
}

const logger = new Logger('MultipartRepair');
const PEEK_BYTES = 240;

type UploadedPart = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

/**
 * Axios 1.16 can POST a multipart photo batch with Content-Type
 * application/x-www-form-urlencoded. The urlencoded parser then returns 400
 * before Multer runs. When the bytes are actually multipart, restore the
 * header (or, if the whole small body is already buffered, parse it here).
 */
export function repairMislabeledMultipart(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!shouldInspect(req)) {
    next();
    return;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  let settled = false;

  const cleanup = () => {
    req.removeListener('readable', pull);
    req.removeListener('end', onEnd);
    req.removeListener('error', fail);
  };

  const fail = (err: Error) => {
    if (settled) return;
    settled = true;
    cleanup();
    next(err);
  };

  const take = (limit: number) => {
    let chunk: Buffer | string | null;
    while (total < limit && (chunk = req.read(limit - total))) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      total += buf.length;
    }
  };

  const head = () =>
    total > 0 ? Buffer.concat(chunks, total) : Buffer.alloc(0);

  const releaseLiveStream = () => {
    if (settled) return;
    settled = true;
    cleanup();
    const prefix = head();
    applyBoundary(req, prefix);
    if (prefix.length > 0) req.unshift(prefix);
    next();
  };

  const drainRest = () => {
    let chunk: Buffer | string | null;
    while ((chunk = req.read())) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      total += buf.length;
    }
  };

  const releaseFinishedBody = () => {
    if (settled) return;
    settled = true;
    cleanup();
    drainRest();
    const body = head();
    const boundary = boundaryFrom(body);
    if (!boundary) {
      restoreStructuredBody(req, body);
      next();
      return;
    }
    const contentType = `multipart/form-data; boundary=${boundary}`;
    parseMultipartBuffer(body, contentType)
      .then((parsed) => {
        req.body = parsed.fields;
        (req as Request & { files?: UploadedPart[] }).files = parsed.files;
        // The socket is already finished, so Multer must not read it again.
        req.headers['content-type'] = 'application/octet-stream';
        logger.warn(
          `Parsed mislabeled multipart body for ${req.method} ${req.originalUrl || req.url}`,
        );
        next();
      })
      .catch((err: unknown) =>
        next(err instanceof Error ? err : new Error(String(err))),
      );
  };

  const pull = () => {
    if (settled) return;
    take(PEEK_BYTES);
    if (total >= PEEK_BYTES && !req.readableEnded) releaseLiveStream();
  };

  const onEnd = () => {
    if (!settled) releaseFinishedBody();
  };

  req.on('error', fail);
  req.on('readable', pull);
  req.on('end', onEnd);
  pull();
}

export function boundaryFrom(head: Buffer): string | null {
  const sample = head.subarray(0, PEEK_BYTES).toString('latin1');
  const match = sample.match(
    /^--([A-Za-z0-9'()+_,\-./:=?]{1,70})(?:\r\n|\n)Content-Disposition:/i,
  );
  return match?.[1] ?? null;
}

function applyBoundary(req: Request, prefix: Buffer) {
  const boundary = boundaryFrom(prefix);
  if (!boundary) return;
  req.headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
  logger.warn(
    `Restored multipart Content-Type for ${req.method} ${req.originalUrl || req.url}`,
  );
}

function restoreStructuredBody(req: Request, body: Buffer) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const text = body.toString('utf8');
  if (contentType.includes('application/json')) {
    try {
      req.body = text ? JSON.parse(text) : {};
    } catch {
      req.body = {};
    }
    return;
  }
  const parsed: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(text)) parsed[key] = value;
  req.body = parsed;
}

function parseMultipartBuffer(buffer: Buffer, contentType: string) {
  return new Promise<{
    fields: Record<string, string>;
    files: UploadedPart[];
  }>((resolve, reject) => {
    const busboy = Busboy({ headers: { 'content-type': contentType } });
    const fields: Record<string, string> = {};
    const files: UploadedPart[] = [];
    let pending = 0;
    let ended = false;

    const finish = () => {
      if (ended && pending === 0) resolve({ fields, files });
    };

    busboy.on('field', (name: string, value: string) => {
      fields[name] = value;
    });
    busboy.on(
      'file',
      (
        name: string,
        stream: Readable,
        info: { filename: string; encoding: string; mimeType: string },
      ) => {
        const parts: Buffer[] = [];
        pending += 1;
        stream.on('data', (chunk: Buffer) => parts.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => {
          const file = Buffer.concat(parts);
          files.push({
            fieldname: name,
            originalname: info.filename,
            encoding: info.encoding,
            mimetype: info.mimeType,
            buffer: file,
            size: file.length,
          });
          pending -= 1;
          finish();
        });
      },
    );
    busboy.on('error', reject);
    busboy.on('finish', () => {
      ended = true;
      finish();
    });
    Readable.from(buffer).pipe(busboy);
  });
}

function shouldInspect(req: Request) {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return false;
  }
  const url = req.originalUrl || req.url || '';
  if (!url.includes('/students/photos/bulk/')) return false;
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType || contentType.includes('multipart/form-data')) return false;
  return (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('application/json')
  );
}
