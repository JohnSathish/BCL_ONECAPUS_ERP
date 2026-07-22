import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const dataDir = path.join(process.cwd(), '.data');
const dataFile = path.join(dataDir, 'visitors.json');
const baseCount = Number(process.env.VISITOR_COUNT_BASE ?? 12847);

async function readCount() {
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw) as { count?: unknown };
    return typeof parsed.count === 'number' && Number.isFinite(parsed.count)
      ? parsed.count
      : baseCount;
  } catch {
    return baseCount;
  }
}

async function writeCount(count: number) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify({ count }), 'utf8');
}

export async function GET() {
  return NextResponse.json({ count: await readCount() });
}

export async function POST() {
  const count = (await readCount()) + 1;
  await writeCount(count);
  return NextResponse.json({ count });
}
