import { NextRequest, NextResponse } from 'next/server';
import { trackVisit, visitorSummary } from '@/lib/visitors';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const path = typeof body.path === 'string' ? body.path : '/';
  await trackVisit(path);
  const summary = await visitorSummary();
  return NextResponse.json({ count: summary.allUnique });
}

export async function GET() {
  const summary = await visitorSummary();
  return NextResponse.json(summary);
}
