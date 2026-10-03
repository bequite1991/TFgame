import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { setUserBanned } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ openid: string }> }) {
  // 封禁/解封：仅超管
  const session = requireRole(request, 'super');
  if (session instanceof NextResponse) return session;

  const { openid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const banned = (body as { banned?: unknown })?.banned;
  if (typeof banned !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'banned must be a boolean' }, { status: 400 });
  }

  const result = await setUserBanned(openid, banned, session.email);
  if (!result) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, openid, status: result.after });
}
