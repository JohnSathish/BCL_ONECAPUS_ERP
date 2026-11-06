import { createDecipheriv, createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { open, stat } from 'fs/promises';
import { basename } from 'path';
import { pipeline } from 'stream/promises';

const ENCRYPTED_MAGIC = Buffer.from('BCLBK1');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export class BackupPackCancelledError extends Error {
  constructor() {
    super('Backup download cancelled');
    this.name = 'BackupPackCancelledError';
  }
}

export type ZipEntry = {
  /** Path inside the archive. Forward slashes, no leading slash. */
  name: string;
  sourcePath: string;
};

export type ZipWriteProgress = {
  /** reading = scan for the ZIP checksum, writing = bytes copied into the archive. */
  phase: 'reading' | 'writing' | 'directory';
  bytesProcessed: number;
  bytesTotal: number;
};

type ZipWriteOptions = {
  onProgress?: (progress: ZipWriteProgress) => void;
  isCancelled?: () => boolean;
};

type WrittenEntry = {
  name: string;
  crc: number;
  size: number;
  offset: number;
};

/** Stream a standard store-method ZIP that WinRAR and 7-Zip can open. */
export async function writeStoreZip(
  outputPath: string,
  entries: ZipEntry[],
  options?: ZipWriteOptions,
) {
  const throwIfCancelled = () => {
    if (options?.isCancelled?.()) throw new BackupPackCancelledError();
  };
  throwIfCancelled();
  const sizes: number[] = [];
  for (const entry of entries) {
    throwIfCancelled();
    sizes.push((await stat(entry.sourcePath)).size);
  }
  const sourceTotal = sizes.reduce((sum, size) => sum + size, 0);
  const crcs: Array<{ crc: number; size: number }> = [];
  let read = 0;
  for (const entry of entries) {
    throwIfCancelled();
    crcs.push(
      await crc32File(entry.sourcePath, {
        isCancelled: options?.isCancelled,
        onBytes: (delta) => {
          read += delta;
          options?.onProgress?.({
            phase: 'reading',
            bytesProcessed: read,
            bytesTotal: sourceTotal,
          });
        },
      }),
    );
  }

  const handle = await open(outputPath, 'w');
  const written: WrittenEntry[] = [];
  let offset = 0;
  let copied = 0;
  try {
    for (let index = 0; index < entries.length; index++) {
      throwIfCancelled();
      const entry = entries[index];
      const name = sanitizeZipName(entry.name);
      const { crc, size } = crcs[index];
      const localOffset = offset;
      const header = localHeader(name, crc, size);
      await handle.write(header, 0, header.length, localOffset);
      offset = await copyFile(
        handle,
        entry.sourcePath,
        localOffset + header.length,
        {
          isCancelled: options?.isCancelled,
          onBytes: (delta) => {
            copied += delta;
            options?.onProgress?.({
              phase: 'writing',
              bytesProcessed: copied,
              bytesTotal: sourceTotal,
            });
          },
        },
      );
      written.push({ name, crc, size, offset: localOffset });
    }

    throwIfCancelled();
    options?.onProgress?.({
      phase: 'directory',
      bytesProcessed: sourceTotal,
      bytesTotal: sourceTotal,
    });
    const cdOffset = offset;
    for (const entry of written) {
      const cd = centralHeader(entry);
      await handle.write(cd, 0, cd.length, offset);
      offset += cd.length;
    }
    const eocd = endOfCentralDirectory(
      written.length,
      offset - cdOffset,
      cdOffset,
    );
    await handle.write(eocd, 0, eocd.length, offset);
  } finally {
    await handle.close();
  }
  return stat(outputPath);
}

/** Confirm the file is a finished ZIP (local header + end of central directory). */
export async function assertZipArchive(filePath: string) {
  const info = await stat(filePath);
  if (info.size < 22) throw new Error('ZIP archive is empty or truncated');
  const handle = await open(filePath, 'r');
  try {
    const start = Buffer.alloc(4);
    await handle.read(start, 0, 4, 0);
    if (
      start[0] !== 0x50 ||
      start[1] !== 0x4b ||
      start[2] !== 0x03 ||
      start[3] !== 0x04
    ) {
      throw new Error('ZIP local file header is missing');
    }
    const tailSize = Math.min(info.size, 65557);
    const tail = Buffer.alloc(tailSize);
    await handle.read(tail, 0, tailSize, info.size - tailSize);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error('ZIP central directory is missing');
    const entries = tail.readUInt16LE(eocd + 10);
    if (entries < 1) throw new Error('ZIP archive contains no files');
  } finally {
    await handle.close();
  }
  return info;
}

async function copyFile(
  handle: Awaited<ReturnType<typeof open>>,
  sourcePath: string,
  position: number,
  hooks?: { onBytes?: (delta: number) => void; isCancelled?: () => boolean },
) {
  let pos = position;
  const stream = createReadStream(sourcePath);
  for await (const chunk of stream) {
    if (hooks?.isCancelled?.()) {
      stream.destroy();
      throw new BackupPackCancelledError();
    }
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    await handle.write(buf, 0, buf.length, pos);
    pos += buf.length;
    hooks?.onBytes?.(buf.length);
  }
  return pos;
}

function sanitizeZipName(name: string) {
  const cleaned = name.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('..'))
    throw new Error('Invalid ZIP entry name');
  return cleaned;
}

async function crc32File(
  filePath: string,
  hooks?: { onBytes?: (delta: number) => void; isCancelled?: () => boolean },
) {
  let crc = 0xffffffff;
  let size = 0;
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    if (hooks?.isCancelled?.()) {
      stream.destroy();
      throw new BackupPackCancelledError();
    }
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    for (let i = 0; i < buf.length; i++) {
      crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    hooks?.onBytes?.(buf.length);
  }
  return { crc: (crc ^ 0xffffffff) >>> 0, size };
}

function dosDateTime(date = new Date()) {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, day };
}

function localHeader(name: string, crc: number, size: number) {
  const fileName = Buffer.from(name);
  const { time, day } = dosDateTime();
  const header = Buffer.alloc(30 + fileName.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(day, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(size, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(fileName.length, 26);
  header.writeUInt16LE(0, 28);
  fileName.copy(header, 30);
  return header;
}

function centralHeader(entry: WrittenEntry) {
  const fileName = Buffer.from(entry.name);
  const { time, day } = dosDateTime();
  const header = Buffer.alloc(46 + fileName.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(time, 12);
  header.writeUInt16LE(day, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.size, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(fileName.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  fileName.copy(header, 46);
  return header;
}

function endOfCentralDirectory(
  count: number,
  cdSize: number,
  cdOffset: number,
) {
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return eocd;
}

export function zipEntryName(filePath: string) {
  return basename(filePath);
}

/** Decrypt a worker backup (BCLBK1 + AES-256-GCM) without modifying the original file. */
export async function materializeBackupPayload(
  filePath: string,
  outputPath: string,
) {
  const handle = await open(filePath, 'r');
  const magic = Buffer.alloc(ENCRYPTED_MAGIC.length);
  await handle.read(magic, 0, magic.length, 0);
  await handle.close();
  if (!magic.equals(ENCRYPTED_MAGIC)) return filePath;

  const key = backupEncryptionKey();
  if (!key) {
    throw new Error(
      'This backup is encrypted. Set BACKUP_ENCRYPTION_KEY before packing the ZIP.',
    );
  }
  await decryptBackupFile(filePath, outputPath, key);
  return outputPath;
}

function backupEncryptionKey() {
  const value = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!value) return null;
  return createHash('sha256').update(value).digest();
}

async function decryptBackupFile(
  encPath: string,
  outputPath: string,
  key: Buffer,
) {
  const handle = await open(encPath, 'r');
  const header = Buffer.alloc(ENCRYPTED_MAGIC.length + 12);
  await handle.read(header, 0, header.length, 0);
  const iv = header.subarray(ENCRYPTED_MAGIC.length);
  const info = await handle.stat();
  const tag = Buffer.alloc(16);
  await handle.read(tag, 0, 16, info.size - 16);
  await handle.close();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  await pipeline(
    createReadStream(encPath, {
      start: ENCRYPTED_MAGIC.length + 12,
      end: info.size - 17,
    }),
    decipher,
    createWriteStream(outputPath),
  );
}
