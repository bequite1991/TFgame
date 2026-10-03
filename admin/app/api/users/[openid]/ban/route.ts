import { NextResponse } from 'next/server';
import { setUserBanned } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ openid: string }> }) {
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

  const result = await setUserBanned(openid, banned);
  if (!result) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, openid, status: result.after });
}
