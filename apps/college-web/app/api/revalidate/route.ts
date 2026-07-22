import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const header = request.headers.get('x-revalidate-secret');
  if (secret && header !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let paths: string[] = ['/'];
  try {
    const body = (await request.json()) as { paths?: string[]; tags?: string[] };
    if (Array.isArray(body.paths) && body.paths.length) paths = body.paths;
    if (Array.isArray(body.tags)) {
      body.tags.forEach((tag) => revalidateTag(tag));
    }
  } catch {
    // empty body is fine
  }

  revalidateTag('website-cms');
  paths.forEach((path) => revalidatePath(path));
  return NextResponse.json({ ok: true, paths, revalidatedAt: new Date().toISOString() });
}
