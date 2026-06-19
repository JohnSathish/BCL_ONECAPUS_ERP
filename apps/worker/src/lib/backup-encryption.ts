import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { open } from 'fs/promises';
import { finished } from 'stream/promises';
import { pipeline } from 'stream/promises';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const MAGIC = Buffer.from('BCLBK1');

export function resolveBackupKey(envValue: string | undefined): Buffer | null {
  if (!envValue?.trim()) return null;
  return createHash('sha256').update(envValue.trim()).digest();
}

export async function encryptFileInPlace(filePath: string, key: Buffer): Promise<string> {
  const encPath = `${filePath}.enc`;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const out = createWriteStream(encPath);
  out.write(Buffer.concat([MAGIC, iv]));
  await pipeline(createReadStream(filePath), cipher, out, { end: false });
  out.write(cipher.getAuthTag());
  out.end();
  await finished(out);
  return encPath;
}

export async function decryptFileToPath(
  encPath: string,
  outputPath: string,
  key: Buffer,
): Promise<void> {
  const fh = await open(encPath, 'r');
  const header = Buffer.alloc(MAGIC.length + IV_LEN);
  await fh.read(header, 0, header.length, 0);
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
    await fh.close();
    throw new Error('Not an encrypted backup file');
  }
  const iv = header.subarray(MAGIC.length);
  const fileStat = await fh.stat();
  const tag = Buffer.alloc(16);
  await fh.read(tag, 0, 16, fileStat.size - 16);
  await fh.close();

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  await pipeline(
    createReadStream(encPath, {
      start: MAGIC.length + IV_LEN,
      end: fileStat.size - 17,
    }),
    decipher,
    createWriteStream(outputPath),
  );
}
