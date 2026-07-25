import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const dataDir = path.join(process.cwd(), '.data');
const dataFile = path.join(dataDir, 'visitors.json');
const baseCount = Number(process.env.VISITOR_COUNT_BASE ?? 12847);
const hashSalt = process.env.VISITOR_HASH_SALT ?? 'dbc-college-visitors';

type VisitorStore = {
  count: number;
  /** Asia/Kolkata calendar day for todayKeys */
  day: string;
  /** Hashed visitor keys already counted today (unique per day) */
  todayKeys: string[];
};

const BOT_UA =
  /bot|spider|crawl|slurp|facebookexternalhit|preview|headless|wget|curl|python-requests|scrapy/i;

function collegeTodayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

function visitorKey(request: NextRequest) {
  const ip = clientIp(request);
  const ua = request.headers.get('user-agent') ?? '';
  return createHash('sha256')
    .update(`${hashSalt}|${ip}|${ua.slice(0, 80)}`)
    .digest('hex');
}

function isBot(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? '';
  if (!ua.trim()) return true;
  return BOT_UA.test(ua);
}

async function readStore(): Promise<VisitorStore> {
  const today = collegeTodayIso();
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<VisitorStore> & { count?: unknown };
    const count =
      typeof parsed.count === 'number' && Number.isFinite(parsed.count) ? parsed.count : baseCount;
    const day = typeof parsed.day === 'string' ? parsed.day : today;
    const todayKeys = Array.isArray(parsed.todayKeys)
      ? parsed.todayKeys.filter((k): k is string => typeof k === 'string').slice(0, 50_000)
      : [];
    return {
      count,
      day,
      todayKeys: day === today ? todayKeys : [],
    };
  } catch {
    return { count: baseCount, day: today, todayKeys: [] };
  }
}

async function writeStore(store: VisitorStore) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(store), 'utf8');
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ count: store.count });
}

export async function POST(request: NextRequest) {
  if (isBot(request)) {
    const store = await readStore();
    return NextResponse.json({ count: store.count, counted: false });
  }

  const today = collegeTodayIso();
  const key = visitorKey(request);
  const store = await readStore();

  if (store.day !== today) {
    store.day = today;
    store.todayKeys = [];
  }

  if (store.todayKeys.includes(key)) {
    return NextResponse.json({ count: store.count, counted: false });
  }

  store.todayKeys.push(key);
  // Cap memory if a flood of keys arrives in one day.
  if (store.todayKeys.length > 50_000) {
    store.todayKeys = store.todayKeys.slice(-40_000);
  }
  store.count += 1;
  await writeStore(store);
  return NextResponse.json({ count: store.count, counted: true });
}
