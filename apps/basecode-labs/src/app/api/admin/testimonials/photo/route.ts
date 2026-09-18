import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/staff';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'No file' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Use JPG, PNG, WebP or GIF' }, { status: 400 });
  }
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const slug = String(form.get('name') ?? 'portrait')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filename = `${slug || 'portrait'}-${Date.now()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'images', 'testimonials');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/images/testimonials/${filename}` });
}
