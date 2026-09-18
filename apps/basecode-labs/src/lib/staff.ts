import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';

export async function requireStaff() {
  const session = await readSession();
  if (!session)
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
  if (session.user.role.startsWith('CLIENT')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null };
  }
  return { error: null, session };
}
