import { NextResponse } from 'next/server';
import { listUsers } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = listUsers();
    return NextResponse.json({ ok: true, total: users.length, users });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
