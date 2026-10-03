import { NextResponse } from 'next/server';
import { getAdminSession, maskOpenid } from '@/lib/auth';
import { listUsers } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = getAdminSession(request);
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const users = listUsers();
    // readonly 角色 openid 打码
    if (session.role === 'readonly') {
      return NextResponse.json({
        ok: true,
        total: users.length,
        users: users.map((u) => ({ ...u, openid: maskOpenid(u.openid) })),
      });
    }
    return NextResponse.json({ ok: true, total: users.length, users });
  } catch {
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
